import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createTestContext,
  flashLiquidate,
  parseAmount,
  readVaultState,
  releaseLocalNode,
  runQuietly,
  setPrices,
  setupMarket,
} from "../test-helpers.js";

describe("Full Flow - Collateral A+B Borrow C", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("deposits A+B collateral, borrows C, flash-liquidates after price drop, then exits position", async () => {
    await runQuietly(async () => {
      const ctx = await createTestContext();
      const borrower = ctx.addresses.C;

      const aliceCollateralAmount = parseAmount("300");
      const bobCollateralAmount = parseAmount("0.2");
      const charlieBorrowAmount = parseAmount("560");

      const wait = async (hash: `0x${string}`) =>
        ctx.publicClient.waitForTransactionReceipt({ hash });

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

      await wait(await ctx.aliceToken.write.approve([ctx.pool.address, aliceCollateralAmount], { account: borrower }));
      await wait(await ctx.pool.write.deposit([ctx.aliceToken.address, aliceCollateralAmount], { account: borrower }));

      await wait(await ctx.bobToken.write.approve([ctx.pool.address, bobCollateralAmount], { account: borrower }));
      await wait(await ctx.pool.write.deposit([ctx.bobToken.address, bobCollateralAmount], { account: borrower }));

      const vaultId = await ctx.pool.read.nextDebtVaultId();
      await wait(await ctx.pool.write.openDebtVault({ account: borrower }));
      await wait(
        await ctx.pool.write.depositCollateral([vaultId, ctx.aliceToken.address, aliceCollateralAmount], {
          account: borrower,
        })
      );
      await wait(
        await ctx.pool.write.depositCollateral([vaultId, ctx.bobToken.address, bobCollateralAmount], {
          account: borrower,
        })
      );
      await wait(await ctx.pool.write.borrow([vaultId, ctx.charlieToken.address, charlieBorrowAmount], { account: borrower }));

      await setPrices(ctx, { alicePrice: "1", bobPrice: "1650", charliePrice: "1" });

      const before = await readVaultState(ctx, vaultId, "charlie");
      assert.ok(before.hf < parseAmount("1"), "vault should be liquidatable after Bob price drop");

      const flashResult = await flashLiquidate(ctx, {
        vaultId,
        caller: "A",
        borrowAsset: "charlie",
        collateralAsset: "bob",
        borrowAmount: "300",
      });

      const after = await readVaultState(ctx, vaultId, "charlie");
      assert.ok(after.debt < before.debt, "debt should decrease after flash liquidation");
      assert.ok(flashResult.feeEarned > 0n, "flash pool should earn fee");

      let remainingDebt = await ctx.pool.read.getDebtVaultDebtAmount([vaultId, ctx.charlieToken.address]);
      for (let repayAttempt = 0; repayAttempt < 3 && remainingDebt > 0n; repayAttempt += 1) {
        const borrowerCharlieBalance = await ctx.charlieToken.read.balanceOf([borrower]);
        assert.ok(borrowerCharlieBalance > 0n, "borrower has no Charlie left to repay debt");

        await wait(await ctx.charlieToken.write.approve([ctx.pool.address, borrowerCharlieBalance], { account: borrower }));
        await wait(await ctx.pool.write.repay([vaultId, ctx.charlieToken.address, borrowerCharlieBalance], { account: borrower }));

        remainingDebt = await ctx.pool.read.getDebtVaultDebtAmount([vaultId, ctx.charlieToken.address]);
      }

      assert.equal(remainingDebt, 0n, "remaining Charlie debt should be fully repaid");

      const collateralAssets = [
        { token: ctx.aliceToken, address: ctx.aliceToken.address },
        { token: ctx.bobToken, address: ctx.bobToken.address },
      ] as const;

      for (const asset of collateralAssets) {
        const remainingCollateral = await ctx.pool.read.getDebtVaultCollateralAssetAmount([vaultId, asset.address]);
        if (remainingCollateral > 0n) {
          await wait(await ctx.pool.write.withdrawCollateral([vaultId, asset.address, remainingCollateral], { account: borrower }));
          await wait(await ctx.pool.write.withdraw([asset.address, remainingCollateral], { account: borrower }));
        }
      }

      const aliceCollateralLeft = await ctx.pool.read.getDebtVaultCollateralAssetAmount([vaultId, ctx.aliceToken.address]);
      const bobCollateralLeft = await ctx.pool.read.getDebtVaultCollateralAssetAmount([vaultId, ctx.bobToken.address]);
      const debtLeft = await ctx.pool.read.getDebtVaultDebtAmount([vaultId, ctx.charlieToken.address]);

      assert.equal(debtLeft, 0n, "debt should be zero after full exit");
      assert.equal(aliceCollateralLeft, 0n, "alice collateral should be zero after full exit");
      assert.equal(bobCollateralLeft, 0n, "bob collateral should be zero after full exit");
    });
  });
});
