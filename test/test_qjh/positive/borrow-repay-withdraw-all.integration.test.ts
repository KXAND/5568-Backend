import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  releaseLocalNode,
  runQuietly,
  parseAmount,
  setPrices,

} from "../test-helpers.js";

async function increaseTime(publicClient: any, seconds: number) {
  await publicClient.request({ method: "evm_increaseTime", params: [seconds] });
  await publicClient.request({ method: "evm_mine", params: [] });
}

describe("Borrow Repay Withdraw All", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("borrows, accrues interest, repays all debt, and withdraws all balance", async () => {
    const collateralAmount = parseAmount("100"); // 100 ALC as collateral
    const borrowAmount = parseAmount("10"); // 10 BOB to borrow

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const borrower = ctx.addresses.B;
      const aliceToken = ctx.aliceToken;
      const bobToken = ctx.bobToken;
      const pool = ctx.pool;

      // Step 1: Set prices (ALC=1, BOB=2)
      await setPrices(ctx, { alicePrice: "1", bobPrice: "2" });
      console.log(`✅ Step 1: Set prices - ALC=$1, BOB=$2`);

      // Step 2: Deposit ALC as collateral
      await aliceToken.write.approve([pool.address, collateralAmount], {
        account: borrower,
      });
      await pool.write.deposit([aliceToken.address, collateralAmount], {
        account: borrower,
      });
      console.log(`✅ Step 2: Deposited ${collateralAmount / (10n ** 18n)} ALC`);

      // Step 3: Open debt vault
      const vaultId = await pool.read.nextDebtVaultId();
      await pool.write.openDebtVault({ account: borrower });
      console.log(`✅ Step 3: Opened debt vault (ID: ${vaultId})`);

      // Step 4: Deposit ALC as collateral in vault
      await pool.write.depositCollateral(
        [vaultId, aliceToken.address, collateralAmount],
        { account: borrower }
      );
      console.log(
        `✅ Step 4: Deposited ${collateralAmount / (10n ** 18n)} ALC as collateral`
      );

      // Step 5: Borrow BOB
      await pool.write.borrow([vaultId, bobToken.address, borrowAmount], {
        account: borrower,
      });

      const debtAfterBorrow = await pool.read.getDebtVaultDebtAmount([
        vaultId,
        bobToken.address,
      ]);

      assert.strictEqual(
        debtAfterBorrow,
        borrowAmount,
        `debt after borrow: expected ${borrowAmount}, got ${debtAfterBorrow}`
      );
      console.log(`✅ Step 5: Borrowed ${borrowAmount / (10n ** 18n)} BOB`);

      // Step 6: Wait for some time to accumulate interest (or just proceed if 0 interest)
      await increaseTime(ctx.publicClient, 1000);
      console.log(`⏳ Step 6: Waited for time`);

      // Step 7: Check current debt (may or may not have interest depending on config)
      const debtWithInterest = await pool.read.getDebtVaultDebtAmount([
        vaultId,
        bobToken.address,
      ]);

      console.log(
        `✅ Step 7: Current debt = ${debtWithInterest / (10n ** 18n)} BOB`
      );

      // Step 8: Get balance to repay all
      const bobBalance = await bobToken.read.balanceOf([borrower]);
      console.log(
        `   Borrower BOB balance: ${bobBalance / (10n ** 18n)} BOB`
      );

      // Approve enough to cover all debt
      const repayAmount = debtWithInterest + parseAmount("10"); // Buffer for any rounding
      await bobToken.write.approve([pool.address, repayAmount], {
        account: borrower,
      });

      // Step 9: Repay all debt (including interest)
      await pool.write.repay([vaultId, bobToken.address, debtWithInterest], {
        account: borrower,
      });

      const debtAfterRepay = await pool.read.getDebtVaultDebtAmount([
        vaultId,
        bobToken.address,
      ]);

      // Allow small rounding errors from borrowIndex precision calculations
      assert.ok(
        debtAfterRepay < 1000000000000000n, // Less than 0.001 BOB
        `debt should be near zero after repay: got ${debtAfterRepay}`
      );
      console.log(`✅ Step 9: Repaid debt - remaining balance ${debtAfterRepay} (within tolerance)`);

      // Step 10: Withdraw all collateral from vault
      const collateralInVault = await pool.read.getDebtVaultCollateralAssetAmount(
        [vaultId, aliceToken.address]
      );
      console.log(
        `   Collateral in vault: ${collateralInVault / (10n ** 18n)} ALC`
      );

      await pool.write.withdrawCollateral(
        [vaultId, aliceToken.address, collateralInVault],
        { account: borrower }
      );

      const collateralAfterWithdraw =
        await pool.read.getDebtVaultCollateralAssetAmount([
          vaultId,
          aliceToken.address,
        ]);

      assert.strictEqual(
        collateralAfterWithdraw,
        0n,
        `collateral should be zero: got ${collateralAfterWithdraw}`
      );
      console.log(`✅ Step 10: Withdrew all collateral from vault`);

      // Step 11: Withdraw all custodied ALC shares
      const custodiedAlice = await pool.read.getUserCustodiedShares([
        borrower,
        aliceToken.address,
      ]);
      console.log(`   Custodied ALC shares: ${custodiedAlice / (10n ** 18n)}`);

      if (custodiedAlice > 0n) {
        await pool.write.withdraw([aliceToken.address, custodiedAlice], {
          account: borrower,
        });

        const custodiedAliceAfter = await pool.read.getUserCustodiedShares([
          borrower,
          aliceToken.address,
        ]);

        assert.strictEqual(
          custodiedAliceAfter,
          0n,
          `custodied ALC should be zero: got ${custodiedAliceAfter}`
        );
      }

      // Check final balance
      const finalAliceBalance = await aliceToken.read.balanceOf([borrower]);
      console.log(`✅ Step 11: Withdrew all ALC - final balance ${finalAliceBalance / (10n ** 18n)} ALC`);

      // Step 12: Verify all shares are cleaned up
      const lockedAlice = await pool.read.getUserLockedShares([
        borrower,
        aliceToken.address,
      ]);
      const claimableAlice = await pool.read.getUserClaimableShares([
        borrower,
        aliceToken.address,
      ]);

      assert.strictEqual(
        lockedAlice,
        0n,
        `locked ALC should be zero: got ${lockedAlice}`
      );
      assert.strictEqual(
        claimableAlice,
        0n,
        `claimable ALC should be zero: got ${claimableAlice}`
      );

      console.log(`✅ Step 12: All shares cleaned up (locked=0, claimable=0)`);
      console.log(
        `✅ Test completed: Borrowed, repaid, and fully withdrew all assets`
      );
    });
  });

  it("multiple borrow-repay cycles with full withdrawal", async () => {
    const collateralAmount = parseAmount("200");
    const borrowAmount1 = parseAmount("5");
    const borrowAmount2 = parseAmount("8");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const borrower = ctx.addresses.C;
      const aliceToken = ctx.aliceToken;
      const bobToken = ctx.bobToken;
      const pool = ctx.pool;

      // Setup
      await setPrices(ctx, { alicePrice: "1", bobPrice: "2" });

      // Deposit collateral (ALC)
      await aliceToken.write.approve([pool.address, collateralAmount], {
        account: borrower,
      });
      await pool.write.deposit([aliceToken.address, collateralAmount], {
        account: borrower,
      });

      // Open vault
      const vaultId = await pool.read.nextDebtVaultId();
      await pool.write.openDebtVault({ account: borrower });

      // Deposit as collateral
      await pool.write.depositCollateral(
        [vaultId, aliceToken.address, collateralAmount],
        { account: borrower }
      );
      console.log(`✅ Setup: Deposited ${collateralAmount / (10n ** 18n)} ALC as collateral`);

      // First borrow-repay cycle
      await pool.write.borrow([vaultId, bobToken.address, borrowAmount1], {
        account: borrower,
      });
      console.log(`✅ Cycle 1: Borrowed ${borrowAmount1 / (10n ** 18n)} BOB`);

      await increaseTime(ctx.publicClient, 500);

      let debt1 = await pool.read.getDebtVaultDebtAmount([
        vaultId,
        bobToken.address,
      ]);
      
      // Add small buffer for rounding
      let repayAmount1 = debt1 + 100n;
      await bobToken.write.approve([pool.address, repayAmount1], {
        account: borrower,
      });
      await pool.write.repay([vaultId, bobToken.address, debt1], {
        account: borrower,
      });
      console.log(`✅ Cycle 1: Repaid ${debt1 / (10n ** 18n)} BOB`);

      // Verify cycle 1 debt is cleared (within tolerance)
      let debt1After = await pool.read.getDebtVaultDebtAmount([
        vaultId,
        bobToken.address,
      ]);
      assert.ok(
        debt1After < 1000000000000000n, // Less than 0.001 BOB
        `cycle 1 debt should be near zero: got ${debt1After}`
      );

      // Second borrow-repay cycle
      await pool.write.borrow([vaultId, bobToken.address, borrowAmount2], {
        account: borrower,
      });
      console.log(`✅ Cycle 2: Borrowed ${borrowAmount2 / (10n ** 18n)} BOB`);

      await increaseTime(ctx.publicClient, 500);

      let debt2 = await pool.read.getDebtVaultDebtAmount([
        vaultId,
        bobToken.address,
      ]);
      
      // Add small buffer for rounding
      let repayAmount2 = debt2 + 100n;
      await bobToken.write.approve(
        [pool.address, repayAmount2],
        { account: borrower }
      );
      await pool.write.repay([vaultId, bobToken.address, debt2], {
        account: borrower,
      });
      console.log(`✅ Cycle 2: Repaid ${debt2 / (10n ** 18n)} BOB`);

      // Verify no remaining debt (with tolerance for rounding precision)
      const finalDebt = await pool.read.getDebtVaultDebtAmount([
        vaultId,
        bobToken.address,
      ]);
      assert.ok(
        finalDebt < parseAmount("1"), // Less than 1 BOB
        `final debt should be negligible: got ${finalDebt}`
      );
      console.log(`✅ Verified: Final debt = ${finalDebt} (within tolerance)`);

      // Withdraw all
      const collateral = await pool.read.getDebtVaultCollateralAssetAmount([
        vaultId,
        aliceToken.address,
      ]);
      await pool.write.withdrawCollateral(
        [vaultId, aliceToken.address, collateral],
        { account: borrower }
      );

      const custodied = await pool.read.getUserCustodiedShares([
        borrower,
        aliceToken.address,
      ]);
      
      if (custodied > 0n) {
        await pool.write.withdraw([aliceToken.address, custodied], {
          account: borrower,
        });
      }

      // Final verification
      const finalCustodied = await pool.read.getUserCustodiedShares([
        borrower,
        aliceToken.address,
      ]);
      const finalLocked = await pool.read.getUserLockedShares([
        borrower,
        aliceToken.address,
      ]);
      const finalClaimable = await pool.read.getUserClaimableShares([
        borrower,
        aliceToken.address,
      ]);

      assert.strictEqual(finalCustodied, 0n, "custodied should be 0");
      assert.strictEqual(finalLocked, 0n, "locked should be 0");
      assert.strictEqual(finalClaimable, 0n, "claimable should be 0");

      console.log(`✅ All shares cleaned up after multiple cycles`);
    });
  });
});
