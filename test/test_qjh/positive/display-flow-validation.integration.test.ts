import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createTestContext,
  directLiquidate,
  exitPosition,
  flashLiquidate,
  openVault,
  parseAmount,
  readVaultState,
  releaseLocalNode,
  runQuietly,
  setPrices,
  setupMarket,
} from "../test-helpers.js";

const HF_TOLERANCE = 0.003;

function toFloat18(value: bigint) {
  return Number(value) / 1e18;
}

function assertNear(actual: number, expected: number, tolerance: number, label: string) {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `${label}: expected ${expected.toFixed(6)}, got ${actual.toFixed(6)} (diff=${diff.toFixed(6)})`
  );
}

describe("Display Flow Validation - Bob Collateral Alice Borrow", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("Part 1: direct liquidation validates documented HF checkpoints", async () => {
    await runQuietly(async () => {
      const ctx = await createTestContext();

      await setupMarket(ctx, {
        initialAlicePrice: "1",
        initialBobPrice: "3000",
        reserveAlice: "2000",
        reserveBob: "0",
        flashAlice: "400",
        flashBob: "0",
        swapAlice: "600",
        swapBob: "0.2",
        swapExchangeRate: "3000",
        claimAliceFaucetFor: ["A", "B", "C", "D"],
        claimBobFaucetFor: ["A", "B", "C", "D"],
        aliceReserveConfig: {
          canBeCollateral: false,
          canBeBorrowed: true,
          ltv: "0",
          liquidationThreshold: "0",
        },
        bobReserveConfig: {
          canBeCollateral: true,
          canBeBorrowed: false,
          ltv: "0.75",
          liquidationThreshold: "0.85",
        },
      });

      const position = await openVault(ctx, {
        borrower: "B",
        collateralAsset: "bob",
        collateralAmount: "0.3",
        borrowAsset: "alice",
        borrowAmount: "425",
      });

      await setPrices(ctx, { alicePrice: "1", bobPrice: "1650" });

      const before = await readVaultState(ctx, position.vaultId, "alice");
      const beforeHf = toFloat18(before.hf);
      assert.ok(beforeHf < 1, `Part 1 HF before liquidation should be < 1, got ${beforeHf.toFixed(6)}`);
      assertNear(beforeHf, 0.99, HF_TOLERANCE, "Part 1 HF before liquidation");

      const liquidation = await directLiquidate(ctx, {
        vaultId: position.vaultId,
        liquidator: "A",
        borrowAsset: "alice",
        collateralAsset: "bob",
        repayAmount: "150",
      });

      const after = await readVaultState(ctx, position.vaultId, "alice");
      const afterHf = toFloat18(after.hf);
      assert.ok(after.debt < before.debt, "Part 1 debt should decrease after direct liquidation");
      assert.ok(liquidation.seizedShares > 0n, "Part 1 liquidator should receive seized shares");
      assert.ok(afterHf > 0.9 && afterHf < 1.2, `Part 1 HF after liquidation out of expected range, got ${afterHf.toFixed(6)}`);
      assert.ok(afterHf >= beforeHf * 0.95, "Part 1 HF should not deteriorate materially after liquidation");

      await exitPosition(ctx, position);
    });
  });

  it("Part 2: single flash liquidation validates documented HF checkpoints", async () => {
    await runQuietly(async () => {
      const ctx = await createTestContext();

      await setupMarket(ctx, {
        initialAlicePrice: "1",
        initialBobPrice: "3000",
        reserveAlice: "2000",
        reserveBob: "0",
        flashAlice: "400",
        flashBob: "0",
        swapAlice: "600",
        swapBob: "0.2",
        swapExchangeRate: "3000",
        claimAliceFaucetFor: ["A", "B", "C", "D"],
        claimBobFaucetFor: ["A", "B", "C", "D"],
        aliceReserveConfig: {
          canBeCollateral: false,
          canBeBorrowed: true,
          ltv: "0",
          liquidationThreshold: "0",
        },
        bobReserveConfig: {
          canBeCollateral: true,
          canBeBorrowed: false,
          ltv: "0.75",
          liquidationThreshold: "0.85",
        },
      });

      const position = await openVault(ctx, {
        borrower: "D",
        collateralAsset: "bob",
        collateralAmount: "0.3",
        borrowAsset: "alice",
        borrowAmount: "425",
      });

      await setPrices(ctx, { alicePrice: "1", bobPrice: "1650" });

      const before = await readVaultState(ctx, position.vaultId, "alice");
      const beforeHf = toFloat18(before.hf);
      assert.ok(beforeHf < 1, `Part 2 HF before liquidation should be < 1, got ${beforeHf.toFixed(6)}`);
      assertNear(beforeHf, 0.99, HF_TOLERANCE, "Part 2 HF before liquidation");

      const flashResult = await flashLiquidate(ctx, {
        vaultId: position.vaultId,
        caller: "A",
        borrowAsset: "alice",
        collateralAsset: "bob",
        borrowAmount: "300",
      });

      const after = await readVaultState(ctx, position.vaultId, "alice");
      const afterHf = toFloat18(after.hf);
      assert.ok(after.debt < before.debt, "Part 2 debt should decrease after flash liquidation");
      assert.ok(flashResult.feeEarned > 0n, "Part 2 flash pool should earn fee");
      assert.ok(afterHf > 0.9 && afterHf < 1.2, `Part 2 HF after liquidation out of expected range, got ${afterHf.toFixed(6)}`);
      assert.ok(afterHf >= beforeHf * 0.95, "Part 2 HF should not deteriorate materially after liquidation");

      await exitPosition(ctx, position);
    });
  });

  it("Part 3: Alice and Bob collateral can borrow Charlie with expected HF checkpoints", async () => {
    await runQuietly(async () => {
      const ctx = await createTestContext();
      const borrower = ctx.addresses.B;

      await setupMarket(ctx, {
        initialAlicePrice: "1",
        initialBobPrice: "3000",
        initialCharliePrice: "1",
        reserveAlice: "0",
        reserveBob: "0",
        reserveCharlie: "2000",
        flashAlice: "400",
        flashBob: "0",
        swapAlice: "600",
        swapBob: "0.2",
        swapExchangeRate: "3000",
        claimAliceFaucetFor: ["A", "B"],
        claimBobFaucetFor: ["A", "B"],
        claimCharlieFaucetFor: ["A"],
        aliceReserveConfig: {
          canBeCollateral: true,
          canBeBorrowed: false,
          ltv: "0.75",
          liquidationThreshold: "0.85",
        },
        bobReserveConfig: {
          canBeCollateral: true,
          canBeBorrowed: false,
          ltv: "0.75",
          liquidationThreshold: "0.85",
        },
        charlieReserveConfig: {
          canBeCollateral: true,
          canBeBorrowed: true,
          ltv: "0.75",
          liquidationThreshold: "0.85",
        },
      });

      const aliceCollateral = "300";
      const bobCollateral = "0.2";
      const charlieBorrow = "500";
      const aliceCollateralAmount = parseAmount(aliceCollateral);
      const bobCollateralAmount = parseAmount(bobCollateral);
      const charlieBorrowAmount = parseAmount(charlieBorrow);

      await ctx.aliceToken.write.approve([ctx.pool.address, aliceCollateralAmount], { account: borrower });
      await ctx.pool.write.deposit([ctx.aliceToken.address, aliceCollateralAmount], { account: borrower });
      await ctx.bobToken.write.approve([ctx.pool.address, bobCollateralAmount], { account: borrower });
      await ctx.pool.write.deposit([ctx.bobToken.address, bobCollateralAmount], { account: borrower });

      const vaultId = await ctx.pool.read.nextDebtVaultId();
      await ctx.pool.write.openDebtVault({ account: borrower });
      await ctx.pool.write.depositCollateral([vaultId, ctx.aliceToken.address, aliceCollateralAmount], { account: borrower });
      await ctx.pool.write.depositCollateral([vaultId, ctx.bobToken.address, bobCollateralAmount], { account: borrower });
      await ctx.pool.write.borrow([vaultId, ctx.charlieToken.address, charlieBorrowAmount], { account: borrower });

      const initial = await readVaultState(ctx, vaultId, "charlie");
      assertNear(toFloat18(initial.hf), 1.53, HF_TOLERANCE, "Part 3 initial HF");

      await setPrices(ctx, { alicePrice: "1", bobPrice: "2200", charliePrice: "1" });
      const after2200 = await readVaultState(ctx, vaultId, "charlie");
      assertNear(toFloat18(after2200.hf), 1.258, HF_TOLERANCE, "Part 3 HF with Bob at 2200");

      await setPrices(ctx, { alicePrice: "1", bobPrice: "1700", charliePrice: "1" });
      const after1700 = await readVaultState(ctx, vaultId, "charlie");
      assertNear(toFloat18(after1700.hf), 1.088, HF_TOLERANCE, "Part 3 HF with Bob at 1700");
      assert.ok(toFloat18(after1700.hf) > 1, "Part 3 should remain healthy at Bob price 1700");
    });
  });

  it("Part 4: Charlie debt can be flash-liquidated using Bob collateral", async () => {
    await runQuietly(async () => {
      const ctx = await createTestContext();
      const borrower = ctx.addresses.C;
      const aliceCollateralAmount = parseAmount("300");
      const bobCollateralAmount = parseAmount("0.2");
      const charlieBorrowAmount = parseAmount("560");

      await setupMarket(ctx, {
        initialAlicePrice: "1",
        initialBobPrice: "3000",
        initialCharliePrice: "1",
        reserveAlice: "0",
        reserveBob: "0",
        reserveCharlie: "2000",
        flashAlice: "400",
        flashBob: "0",
        flashCharlie: "1000",
        swapAlice: "1000",
        swapBob: "0.2",
        swapCharlie: "1000",
        swapExchangeRate: "3000",
        claimAliceFaucetFor: ["A", "C"],
        claimBobFaucetFor: ["A", "C"],
        claimCharlieFaucetFor: ["A"],
        aliceReserveConfig: {
          canBeCollateral: true,
          canBeBorrowed: false,
          ltv: "0.75",
          liquidationThreshold: "0.85",
        },
        bobReserveConfig: {
          canBeCollateral: true,
          canBeBorrowed: false,
          ltv: "0.75",
          liquidationThreshold: "0.85",
        },
        charlieReserveConfig: {
          canBeCollateral: true,
          canBeBorrowed: true,
          ltv: "0.75",
          liquidationThreshold: "0.85",
        },
      });

      await ctx.aliceToken.write.approve([ctx.pool.address, aliceCollateralAmount], { account: borrower });
      await ctx.pool.write.deposit([ctx.aliceToken.address, aliceCollateralAmount], { account: borrower });
      await ctx.bobToken.write.approve([ctx.pool.address, bobCollateralAmount], { account: borrower });
      await ctx.pool.write.deposit([ctx.bobToken.address, bobCollateralAmount], { account: borrower });

      const vaultId = await ctx.pool.read.nextDebtVaultId();
      await ctx.pool.write.openDebtVault({ account: borrower });
      await ctx.pool.write.depositCollateral([vaultId, ctx.aliceToken.address, aliceCollateralAmount], { account: borrower });
      await ctx.pool.write.depositCollateral([vaultId, ctx.bobToken.address, bobCollateralAmount], { account: borrower });
      await ctx.pool.write.borrow([vaultId, ctx.charlieToken.address, charlieBorrowAmount], { account: borrower });

      await setPrices(ctx, { alicePrice: "1", bobPrice: "1650", charliePrice: "1" });
      const before = await readVaultState(ctx, vaultId, "charlie");
      const beforeHf = toFloat18(before.hf);
      assert.ok(beforeHf < 1, `Part 4 HF before liquidation should be < 1, got ${beforeHf.toFixed(6)}`);
      assertNear(beforeHf, 0.95625, HF_TOLERANCE, "Part 4 HF before liquidation");

      const flashResult = await flashLiquidate(ctx, {
        vaultId,
        caller: "A",
        borrowAsset: "charlie",
        collateralAsset: "bob",
        borrowAmount: "300",
      });

      const after = await readVaultState(ctx, vaultId, "charlie");
      const afterHf = toFloat18(after.hf);
      assert.ok(after.debt < before.debt, "Part 4 debt should decrease after CHL flash liquidation");
      assert.ok(flashResult.feeEarned > 0n, "Part 4 flash pool should earn Charlie fee");
      assert.ok(afterHf > beforeHf, "Part 4 HF should improve after CHL flash liquidation");
      assert.ok(afterHf > 0.95 && afterHf < 1.05, `Part 4 HF after liquidation out of expected range, got ${afterHf.toFixed(6)}`);
    });
  });
});
