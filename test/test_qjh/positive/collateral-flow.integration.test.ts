import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  releaseLocalNode,
  runQuietly,
  parseAmount,
} from "../test-helpers.js";

describe("LendingPool Collateral Flow", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("deposits collateral and verifies locked shares", async () => {
    const depositAmount = parseAmount("100");
    const collateralAmount = parseAmount("50");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const walletB = ctx.addresses.B;
      const aliceToken = ctx.aliceToken;
      const pool = ctx.pool;

      // Step 1: First deposit to get aToken shares
      await aliceToken.write.approve([pool.address, depositAmount], {
        account: walletB,
      });

      await pool.write.deposit([aliceToken.address, depositAmount], {
        account: walletB,
      });

      const custodiedAfterDeposit = await pool.read.getUserCustodiedShares([
        walletB,
        aliceToken.address,
      ]);

      assert.strictEqual(
        custodiedAfterDeposit,
        depositAmount,
        `after deposit: expected ${depositAmount}, got ${custodiedAfterDeposit}`
      );
      console.log(`✅ Step 1: Deposited ${depositAmount / (10n ** 18n)} ALC`);

      // Step 2: Open debt vault
      const vaultId = await pool.read.nextDebtVaultId();
      await pool.write.openDebtVault({ account: walletB });
      console.log(`✅ Step 2: Opened debt vault with ID ${vaultId}`);

      // Step 3: Deposit as collateral
      await pool.write.depositCollateral(
        [vaultId, aliceToken.address, collateralAmount],
        { account: walletB }
      );

      const custodiedAfterCollateral = await pool.read.getUserCustodiedShares([
        walletB,
        aliceToken.address,
      ]);

      const lockedShares = await pool.read.getUserLockedShares([
        walletB,
        aliceToken.address,
      ]);

      const claimableShares = await pool.read.getUserClaimableShares([
        walletB,
        aliceToken.address,
      ]);

      // Verify shares distribution
      assert.strictEqual(
        custodiedAfterCollateral,
        depositAmount,
        `custodied shares should remain: expected ${depositAmount}, got ${custodiedAfterCollateral}`
      );

      assert.strictEqual(
        lockedShares,
        collateralAmount,
        `locked shares: expected ${collateralAmount}, got ${lockedShares}`
      );

      assert.strictEqual(
        claimableShares,
        depositAmount - collateralAmount,
        `claimable shares: expected ${depositAmount - collateralAmount}, got ${claimableShares}`
      );

      console.log(`✅ Step 3: Deposited ${collateralAmount / (10n ** 18n)} ALC as collateral`);
      console.log(`✅ Step 4: Verified locked shares = ${lockedShares / (10n ** 18n)} ALC`);
      console.log(`✅ Step 5: Verified claimable shares = ${claimableShares / (10n ** 18n)} ALC`);
    });
  });

  it("deposits multiple collateral assets and verifies separation", async () => {
    const amount = parseAmount("50");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const walletC = ctx.addresses.C;
      const aliceToken = ctx.aliceToken;
      const bobToken = ctx.bobToken;
      const pool = ctx.pool;

      // Deposit both assets
      await aliceToken.write.approve([pool.address, amount], {
        account: walletC,
      });
      await pool.write.deposit([aliceToken.address, amount], {
        account: walletC,
      });

      await bobToken.write.approve([pool.address, amount], {
        account: walletC,
      });
      await pool.write.deposit([bobToken.address, amount], {
        account: walletC,
      });

      console.log(`✅ Deposited ${amount / (10n ** 18n)} ALC and ${amount / (10n ** 18n)} BOB`);

      // Open vault
      const vaultId = await pool.read.nextDebtVaultId();
      await pool.write.openDebtVault({ account: walletC });

      // Deposit both as collateral (only Alice can be collateral in this fixture)
      await pool.write.depositCollateral([vaultId, aliceToken.address, amount], {
        account: walletC,
      });

      console.log(`✅ Deposited ${amount / (10n ** 18n)} ALC as collateral`);

      // Verify Alice shares
      const aliceLocked = await pool.read.getUserLockedShares([
        walletC,
        aliceToken.address,
      ]);
      const aliceClaimable = await pool.read.getUserClaimableShares([
        walletC,
        aliceToken.address,
      ]);

      assert.strictEqual(
        aliceLocked,
        amount,
        `alice locked: expected ${amount}, got ${aliceLocked}`
      );
      assert.strictEqual(
        aliceClaimable,
        amount - amount,
        `alice claimable: expected 0, got ${aliceClaimable}`
      );

      // Verify Bob shares (not used as collateral)
      const bobLocked = await pool.read.getUserLockedShares([
        walletC,
        bobToken.address,
      ]);
      const bobClaimable = await pool.read.getUserClaimableShares([
        walletC,
        bobToken.address,
      ]);

      assert.strictEqual(
        bobLocked,
        0n,
        `bob locked: expected 0, got ${bobLocked}`
      );
      assert.strictEqual(
        bobClaimable,
        amount,
        `bob claimable: expected ${amount}, got ${bobClaimable}`
      );

      console.log(`✅ Verified ALC: locked=${aliceLocked / (10n ** 18n)}, claimable=${aliceClaimable / (10n ** 18n)}`);
      console.log(`✅ Verified BOB: locked=${bobLocked / (10n ** 18n)}, claimable=${bobClaimable / (10n ** 18n)}`);
    });
  });

  it("withdraws collateral and verifies share restoration", async () => {
    const initialDeposit = parseAmount("100");
    const collateralAmount = parseAmount("60");
    const withdrawAmount = parseAmount("30");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const walletD = ctx.addresses.D;
      const aliceToken = ctx.aliceToken;
      const pool = ctx.pool;

      // Deposit
      await aliceToken.write.approve([pool.address, initialDeposit], {
        account: walletD,
      });
      await pool.write.deposit([aliceToken.address, initialDeposit], {
        account: walletD,
      });

      console.log(`✅ Step 1: Deposited ${initialDeposit / (10n ** 18n)} ALC`);

      // Open vault and deposit as collateral
      const vaultId = await pool.read.nextDebtVaultId();
      await pool.write.openDebtVault({ account: walletD });

      await pool.write.depositCollateral(
        [vaultId, aliceToken.address, collateralAmount],
        { account: walletD }
      );

      const lockedAfterCollateral = await pool.read.getUserLockedShares([
        walletD,
        aliceToken.address,
      ]);

      assert.strictEqual(
        lockedAfterCollateral,
        collateralAmount,
        `locked after collateral: expected ${collateralAmount}, got ${lockedAfterCollateral}`
      );
      console.log(`✅ Step 2: Deposited ${collateralAmount / (10n ** 18n)} ALC as collateral`);

      // Withdraw collateral
      await pool.write.withdrawCollateral(
        [vaultId, aliceToken.address, withdrawAmount],
        { account: walletD }
      );

      const lockedAfterWithdraw = await pool.read.getUserLockedShares([
        walletD,
        aliceToken.address,
      ]);

      const claimableAfterWithdraw = await pool.read.getUserClaimableShares([
        walletD,
        aliceToken.address,
      ]);

      const expectedLocked = collateralAmount - withdrawAmount;
      const expectedClaimable = initialDeposit - expectedLocked;

      assert.strictEqual(
        lockedAfterWithdraw,
        expectedLocked,
        `locked after withdraw: expected ${expectedLocked}, got ${lockedAfterWithdraw}`
      );

      assert.strictEqual(
        claimableAfterWithdraw,
        expectedClaimable,
        `claimable after withdraw: expected ${expectedClaimable}, got ${claimableAfterWithdraw}`
      );

      console.log(`✅ Step 3: Withdrew ${withdrawAmount / (10n ** 18n)} ALC from collateral`);
      console.log(`✅ Step 4: Verified locked shares = ${lockedAfterWithdraw / (10n ** 18n)} ALC`);
      console.log(`✅ Step 5: Verified claimable shares = ${claimableAfterWithdraw / (10n ** 18n)} ALC`);
    });
  });

  it("verifies collateral assets list in debt vault", async () => {
    const amount = parseAmount("50");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const walletB = ctx.addresses.B;
      const aliceToken = ctx.aliceToken;
      const bobToken = ctx.bobToken;
      const pool = ctx.pool;

      // Deposit both assets
      await aliceToken.write.approve([pool.address, amount], {
        account: walletB,
      });
      await pool.write.deposit([aliceToken.address, amount], {
        account: walletB,
      });

      await bobToken.write.approve([pool.address, amount], {
        account: walletB,
      });
      await pool.write.deposit([bobToken.address, amount], {
        account: walletB,
      });

      // Open vault
      const vaultId = await pool.read.nextDebtVaultId();
      await pool.write.openDebtVault({ account: walletB });

      // Deposit only Alice as collateral (only Alice can be collateral in this fixture)
      await pool.write.depositCollateral([vaultId, aliceToken.address, amount], {
        account: walletB,
      });

      console.log(`✅ Deposited ALC as collateral`);

      // Get collateral assets list
      const collateralAssets = await pool.read.getDebtVaultCollateralAssets([vaultId]);

      assert.strictEqual(
        collateralAssets.length,
        1,
        `should have 1 collateral asset, got ${collateralAssets.length}`
      );

      const hasAlice = collateralAssets.some((addr: string) => addr.toLowerCase() === aliceToken.address.toLowerCase());

      assert.ok(hasAlice, "should have ALC in collateral assets");

      console.log(`✅ Verified collateral assets list contains ALC`);

      // Verify collateral amount
      const aliceCollateral = await pool.read.getDebtVaultCollateralAssetAmount(
        [vaultId, aliceToken.address]
      );

      assert.strictEqual(
        aliceCollateral,
        amount,
        `alice collateral: expected ${amount}, got ${aliceCollateral}`
      );

      console.log(`✅ Verified ALC collateral = ${aliceCollateral / (10n ** 18n)}`);
    });
  });
});
