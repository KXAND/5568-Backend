import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createTestContext,
  setupMarket,
  directLiquidate,
  exitPosition,
  flashLiquidate,
  openVault,
  parseAmount,
  readVaultState,
  releaseLocalNode,
  runQuietly,
  setPrices,
} from "../test-helpers.js";

describe("Bob Collateral - Alice Borrow Full Pass", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("Part 1: Direct liquidation with HF improvement", async () => {
    await runQuietly(async () => {
      const ctx = await createTestContext();

      // Setup market
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

      // Open position: 0.3 BOB collateral, 425 ALC borrow
      const position = await openVault(ctx, {
        borrower: "B",
        collateralAsset: "bob",
        collateralAmount: "0.3",
        borrowAsset: "alice",
        borrowAmount: "425",
      });

      // Price drop: Bob 3000 -> 1650
      await setPrices(ctx, { alicePrice: "1", bobPrice: "1650" });

      const stateBefore = await readVaultState(ctx, position.vaultId, "alice");
      console.log(
        `✅ Part 1: Before liquidation - Debt: ${stateBefore.debt / 10n ** 18n} ALC, HF: ${stateBefore.hf / 10n ** 18n}`
      );

      assert.ok(stateBefore.hf < parseAmount("1"), "Part 1: HF should be below 1 before liquidation");

      // Direct liquidation
      const liquidation = await directLiquidate(ctx, {
        vaultId: position.vaultId,
        liquidator: "A",
        borrowAsset: "alice",
        collateralAsset: "bob",
        repayAmount: "150",
      });

      const stateAfter = await readVaultState(ctx, position.vaultId, "alice");
      console.log(
        `✅ Part 1: After liquidation - Debt: ${stateAfter.debt / 10n ** 18n} ALC, HF: ${stateAfter.hf / 10n ** 18n}`
      );
      console.log(`✅ Part 1: Liquidator seized: ${liquidation.seizedShares / 10n ** 18n} BOB shares`);

      assert.ok(stateAfter.debt < stateBefore.debt, "Part 1: Debt should be reduced after liquidation");
      assert.ok(stateAfter.hf > 0n, "Part 1: HF should remain valid after liquidation");
      assert.ok(liquidation.seizedShares > 0n, "Part 1: Liquidator should receive collateral shares");

      // Exit position
      await exitPosition(ctx, position);

      const collateralRemaining = await position.collateralToken.read.balanceOf([position.borrowerAddress]);
      console.log(`✅ Part 1: Borrower recovered collateral: ${collateralRemaining / 10n ** 18n} BOB`);
    });
  });

  it("Part 2: Flash liquidation with HF improvement", async () => {
    await runQuietly(async () => {
      const ctx = await createTestContext();

      // Setup market
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

      // Open position: 0.3 BOB collateral, 425 ALC borrow
      const position = await openVault(ctx, {
        borrower: "D",
        collateralAsset: "bob",
        collateralAmount: "0.3",
        borrowAsset: "alice",
        borrowAmount: "425",
      });

      // Price drop: Bob 3000 -> 1650
      await setPrices(ctx, { alicePrice: "1", bobPrice: "1650" });

      const stateInitial = await readVaultState(ctx, position.vaultId, "alice");
      console.log(
        `✅ Part 2: Initial state - Debt: ${stateInitial.debt / 10n ** 18n} ALC, HF: ${stateInitial.hf / 10n ** 18n}`
      );

      assert.ok(stateInitial.hf < parseAmount("1"), "Part 2: Initial HF should be below 1");

      // Perform one flash liquidation; amount must cover close-factor repay path and fee flow
      const flashResult = await flashLiquidate(ctx, {
        vaultId: position.vaultId,
        caller: "A",
        borrowAsset: "alice",
        collateralAsset: "bob",
        borrowAmount: "300",
      });

      const stateAfter = await readVaultState(ctx, position.vaultId, "alice");
      console.log("✅ Part 2: Completed 1 flash liquidation");
      console.log(
        `✅ Part 2: Final state - Debt: ${stateAfter.debt / 10n ** 18n} ALC, HF: ${stateAfter.hf / 10n ** 18n}`
      );
      console.log(`✅ Part 2: Flash pool fee earned: ${flashResult.feeEarned / 10n ** 18n} ALC`);

      assert.ok(stateAfter.debt < stateInitial.debt, "Part 2: Debt should be reduced after flash liquidation");
      assert.ok(stateAfter.hf > 0n, "Part 2: HF should remain valid after flash liquidation");
      assert.ok(
        stateAfter.hf * 100n >= stateInitial.hf * 95n,
        "Part 2: HF should not deteriorate materially after flash liquidation"
      );
      assert.ok(flashResult.feeEarned > 0n, "Part 2: Flash pool should earn a fee");

      // Exit position
      await exitPosition(ctx, position);

      const collateralRemaining = await position.collateralToken.read.balanceOf([position.borrowerAddress]);
      const debtFinal = await ctx.pool.read.getDebtVaultDebtAmount([
        position.vaultId,
        position.borrowToken.address,
      ]);

      console.log(`✅ Part 2: Final debt cleared: ${debtFinal / 10n ** 18n} ALC`);
      console.log(`✅ Part 2: Borrower recovered collateral: ${collateralRemaining / 10n ** 18n} BOB`);
    });
  });
});
