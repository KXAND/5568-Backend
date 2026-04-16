import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  releaseLocalNode,
  runQuietly,
  parseAmount,
} from "../test-helpers.js";

describe("LendingPool Deposit Flow", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("deposits various amounts and verifies custodied shares", async () => {
    const depositCases = [
      {
        asset: "alice",
        amount: "10",
        label: "deposit 10 ALC",
      },
      {
        asset: "bob",
        amount: "5",
        label: "deposit 5 BOB",
      },
      {
        asset: "alice",
        amount: "50",
        label: "deposit 50 ALC",
      },
      {
        asset: "bob",
        amount: "100",
        label: "deposit 100 BOB",
      },
    ] as const;

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const walletA = ctx.addresses.A;
      const aliceToken = ctx.aliceToken;
      const bobToken = ctx.bobToken;
      const pool = ctx.pool;

      for (const testCase of depositCases) {
        const token = testCase.asset === "alice" ? aliceToken : bobToken;
        const depositAmount = parseAmount(testCase.amount);

        // Get custodied shares before deposit
        const custodiedBefore = await pool.read.getUserCustodiedShares([
          walletA,
          token.address,
        ]);

        // Approve and deposit
        await token.write.approve([pool.address, depositAmount], {
          account: walletA,
        });

        await pool.write.deposit([token.address, depositAmount], {
          account: walletA,
        });

        // Get custodied shares after deposit
        const custodiedAfter = await pool.read.getUserCustodiedShares([
          walletA,
          token.address,
        ]);

        // Verify deposit increased custodied shares
        const depositedShares = custodiedAfter - custodiedBefore;
        assert.strictEqual(
          depositedShares,
          depositAmount,
          `${testCase.label}: expected ${depositAmount} shares, got ${depositedShares}`
        );

        console.log(`✅ ${testCase.label}: verified custodied shares = ${testCase.amount}`);
      }
    });
  });

  it("deposits and verifies claimable shares", async () => {
    const depositAmount = parseAmount("20");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const walletB = ctx.addresses.B;
      const aliceToken = ctx.aliceToken;
      const pool = ctx.pool;

      // Approve and deposit
      await aliceToken.write.approve([pool.address, depositAmount], {
        account: walletB,
      });

      await pool.write.deposit([aliceToken.address, depositAmount], {
        account: walletB,
      });

      // Check custodied shares
      const custodiedShares = await pool.read.getUserCustodiedShares([
        walletB,
        aliceToken.address,
      ]);

      // Check locked shares (should be 0 since not used as collateral)
      const lockedShares = await pool.read.getUserLockedShares([
        walletB,
        aliceToken.address,
      ]);

      // Check claimable shares (should equal custodied shares)
      const claimableShares = await pool.read.getUserClaimableShares([
        walletB,
        aliceToken.address,
      ]);

      assert.strictEqual(
        custodiedShares,
        depositAmount,
        `custodied shares mismatch: expected ${depositAmount}, got ${custodiedShares}`
      );

      assert.strictEqual(
        lockedShares,
        0n,
        `locked shares should be 0, got ${lockedShares}`
      );

      assert.strictEqual(
        claimableShares,
        depositAmount,
        `claimable shares should equal deposited amount: expected ${depositAmount}, got ${claimableShares}`
      );

      console.log("✅ deposit and claimable shares verification passed");
    });
  });

  it("deposits to multiple users and verifies isolation", async () => {
    const depositAmount = parseAmount("15");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const walletB = ctx.addresses.B;
      const walletC = ctx.addresses.C;
      const aliceToken = ctx.aliceToken;
      const pool = ctx.pool;

      // User B deposits ALC
      await aliceToken.write.approve([pool.address, depositAmount], {
        account: walletB,
      });

      await pool.write.deposit([aliceToken.address, depositAmount], {
        account: walletB,
      });

      // User C deposits ALC
      await aliceToken.write.approve([pool.address, depositAmount], {
        account: walletC,
      });

      await pool.write.deposit([aliceToken.address, depositAmount], {
        account: walletC,
      });

      // Verify each user has independent custodied shares
      const custodiedB = await pool.read.getUserCustodiedShares([
        walletB,
        aliceToken.address,
      ]);
      const custodiedC = await pool.read.getUserCustodiedShares([
        walletC,
        aliceToken.address,
      ]);

      assert.strictEqual(
        custodiedB,
        depositAmount,
        `user B custodied shares mismatch: expected ${depositAmount}, got ${custodiedB}`
      );

      assert.strictEqual(
        custodiedC,
        depositAmount,
        `user C custodied shares mismatch: expected ${depositAmount}, got ${custodiedC}`
      );

      console.log("✅ multi-user deposit isolation verified");
    });
  });

  it("completes full deposit and withdraw flow", async () => {
    const initialDeposit = parseAmount("50");
    const withdrawAmount = parseAmount("20");
    const remainingAmount = parseAmount("30");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const walletD = ctx.addresses.D;
      const aliceToken = ctx.aliceToken;
      const pool = ctx.pool;

      // Step 1: Approve and deposit initial amount
      await aliceToken.write.approve([pool.address, initialDeposit], {
        account: walletD,
      });

      await pool.write.deposit([aliceToken.address, initialDeposit], {
        account: walletD,
      });

      const custodiedAfterDeposit = await pool.read.getUserCustodiedShares([
        walletD,
        aliceToken.address,
      ]);

      assert.strictEqual(
        custodiedAfterDeposit,
        initialDeposit,
        `after deposit: expected ${initialDeposit}, got ${custodiedAfterDeposit}`
      );
      console.log(`✅ Step 1: Deposited ${initialDeposit / (10n ** 18n)} ALC`);

      // Step 2: Verify claimable shares before withdrawal
      const claimableBefore = await pool.read.getUserClaimableShares([
        walletD,
        aliceToken.address,
      ]);

      assert.strictEqual(
        claimableBefore,
        initialDeposit,
        `claimable before withdraw: expected ${initialDeposit}, got ${claimableBefore}`
      );
      console.log(`✅ Step 2: Verified claimable shares = ${claimableBefore / (10n ** 18n)} ALC`);

      // Step 3: Withdraw partial amount
      await pool.write.withdraw([aliceToken.address, withdrawAmount], {
        account: walletD,
      });

      const custodiedAfterWithdraw = await pool.read.getUserCustodiedShares([
        walletD,
        aliceToken.address,
      ]);

      assert.strictEqual(
        custodiedAfterWithdraw,
        remainingAmount,
        `after withdraw: expected ${remainingAmount}, got ${custodiedAfterWithdraw}`
      );
      console.log(`✅ Step 3: Withdrew ${withdrawAmount / (10n ** 18n)} ALC`);

      // Step 4: Verify claimable shares after withdrawal
      const claimableAfter = await pool.read.getUserClaimableShares([
        walletD,
        aliceToken.address,
      ]);

      assert.strictEqual(
        claimableAfter,
        remainingAmount,
        `claimable after withdraw: expected ${remainingAmount}, got ${claimableAfter}`
      );
      console.log(`✅ Step 4: Verified claimable shares = ${claimableAfter / (10n ** 18n)} ALC`);

      // Step 5: Verify locked shares remain 0 (not used as collateral)
      const lockedShares = await pool.read.getUserLockedShares([
        walletD,
        aliceToken.address,
      ]);

      assert.strictEqual(
        lockedShares,
        0n,
        `locked shares should be 0, got ${lockedShares}`
      );
      console.log("✅ Step 5: Verified locked shares = 0 (not used as collateral)");

      console.log("✅ Full deposit and withdraw flow completed successfully");
    });
  });
});
