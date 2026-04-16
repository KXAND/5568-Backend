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

describe("LendingPool Collateral Flow", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("deposits collateral and verifies locked shares", async () => {
    const collateralAmount = parseAmount("100");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const user = ctx.addresses.B;
      const aliceToken = ctx.aliceToken;
      const pool = ctx.pool;

      // Set prices
      await setPrices(ctx, { alicePrice: "1", bobPrice: "2" });

      // Deposit ALC to get custodied shares
      await aliceToken.write.approve([pool.address, collateralAmount], {
        account: user,
      });
      await pool.write.deposit([aliceToken.address, collateralAmount], {
        account: user,
      });

      // Open debt vault
      const vaultId = await pool.read.nextDebtVaultId();
      await pool.write.openDebtVault({ account: user });

      // Deposit as collateral - should convert custodied to locked
      await pool.write.depositCollateral(
        [vaultId, aliceToken.address, collateralAmount],
        { account: user }
      );

      // Verify collateral is in vault
      const collateralInVault =
        await pool.read.getDebtVaultCollateralAssetAmount([
          vaultId,
          aliceToken.address,
        ]);

      assert.strictEqual(
        collateralInVault,
        collateralAmount,
        `collateral in vault should be ${collateralAmount}, got ${collateralInVault}`
      );

      console.log(
        `✅ Test: Deposited ${collateralInVault / (10n ** 18n)} ALC as collateral`
      );
    });
  });

  it("deposits multiple collateral assets and verifies separation", async () => {
    const aliceAmount = parseAmount("100");
    const aliceAmount2 = parseAmount("50");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const user1 = ctx.addresses.B;
      const user2 = ctx.addresses.C;
      const aliceToken = ctx.aliceToken;
      const pool = ctx.pool;

      // Setup prices
      await setPrices(ctx, { alicePrice: "1", bobPrice: "2" });

      // User 1: Deposit and collateralize ALC
      await aliceToken.write.approve([pool.address, aliceAmount], {
        account: user1,
      });
      await pool.write.deposit([aliceToken.address, aliceAmount], {
        account: user1,
      });

      const vaultId1 = await pool.read.nextDebtVaultId();
      await pool.write.openDebtVault({ account: user1 });

      await pool.write.depositCollateral(
        [vaultId1, aliceToken.address, aliceAmount],
        { account: user1 }
      );

      // User 2: Deposit and collateralize different amount of ALC
      await aliceToken.write.approve([pool.address, aliceAmount2], {
        account: user2,
      });
      await pool.write.deposit([aliceToken.address, aliceAmount2], {
        account: user2,
      });

      const vaultId2 = await pool.read.nextDebtVaultId();
      await pool.write.openDebtVault({ account: user2 });

      await pool.write.depositCollateral(
        [vaultId2, aliceToken.address, aliceAmount2],
        { account: user2 }
      );

      // Verify each vault has separate collateral amounts
      const collateral1 =
        await pool.read.getDebtVaultCollateralAssetAmount([
          vaultId1,
          aliceToken.address,
        ]);
      const collateral2 =
        await pool.read.getDebtVaultCollateralAssetAmount([
          vaultId2,
          aliceToken.address,
        ]);

      assert.strictEqual(
        collateral1,
        aliceAmount,
        `Vault 1 collateral should be ${aliceAmount}, got ${collateral1}`
      );
      assert.strictEqual(
        collateral2,
        aliceAmount2,
        `Vault 2 collateral should be ${aliceAmount2}, got ${collateral2}`
      );

      console.log(
        `✅ Test: Vault 1 has ${collateral1 / (10n ** 18n)} ALC, Vault 2 has ${collateral2 / (10n ** 18n)} ALC`
      );
    });
  });

  it("withdraws collateral and verifies share restoration", async () => {
    const depositAmount = parseAmount("100");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const user = ctx.addresses.B;
      const aliceToken = ctx.aliceToken;
      const pool = ctx.pool;

      // Setup
      await setPrices(ctx, { alicePrice: "1", bobPrice: "2" });

      // Deposit
      await aliceToken.write.approve([pool.address, depositAmount], {
        account: user,
      });
      await pool.write.deposit([aliceToken.address, depositAmount], {
        account: user,
      });

      // Open vault and deposit as collateral
      const vaultId = await pool.read.nextDebtVaultId();
      await pool.write.openDebtVault({ account: user });

      await pool.write.depositCollateral(
        [vaultId, aliceToken.address, depositAmount],
        { account: user }
      );

      // Verify locked
      const lockedBefore = await pool.read.getUserLockedShares([
        user,
        aliceToken.address,
      ]);
      assert.strictEqual(
        lockedBefore,
        depositAmount,
        "Should have locked shares"
      );

      // Withdraw collateral
      await pool.write.withdrawCollateral(
        [vaultId, aliceToken.address, depositAmount],
        { account: user }
      );

      // Verify shares are restored to custodied
      const lockedAfter = await pool.read.getUserLockedShares([
        user,
        aliceToken.address,
      ]);
      const custodiedAfter = await pool.read.getUserCustodiedShares([
        user,
        aliceToken.address,
      ]);

      assert.strictEqual(
        lockedAfter,
        0n,
        `Locked should be 0, got ${lockedAfter}`
      );
      assert.strictEqual(
        custodiedAfter,
        depositAmount,
        `Custodied should be ${depositAmount}, got ${custodiedAfter}`
      );

      console.log(
        `✅ Test: Withdrew ${depositAmount / (10n ** 18n)} ALC, restored to custodied`
      );
    });
  });

  it("verifies collateral assets list in debt vault", async () => {
    const aliceAmount = parseAmount("100");
    const bobAmount = parseAmount("50");

    await runQuietly(async () => {
      const ctx = await createAliceBobFixture();
      const user = ctx.addresses.B;
      const aliceToken = ctx.aliceToken;
      const bobToken = ctx.bobToken;
      const pool = ctx.pool;

      // Setup
      await setPrices(ctx, { alicePrice: "1", bobPrice: "2" });

      // Deposit both tokens
      await aliceToken.write.approve([pool.address, aliceAmount], {
        account: user,
      });
      await pool.write.deposit([aliceToken.address, aliceAmount], {
        account: user,
      });

      await bobToken.write.approve([pool.address, bobAmount], {
        account: user,
      });
      await pool.write.deposit([bobToken.address, bobAmount], {
        account: user,
      });

      // Open vault
      const vaultId = await pool.read.nextDebtVaultId();
      await pool.write.openDebtVault({ account: user });

      // Deposit both as collateral
      await pool.write.depositCollateral(
        [vaultId, aliceToken.address, aliceAmount],
        { account: user }
      );
      await pool.write.depositCollateral(
        [vaultId, bobToken.address, bobAmount],
        { account: user }
      );

      // Get collateral assets list
      const collateralAssets = await pool.read.getDebtVaultCollateralAssets([
        vaultId,
      ]);

      assert.strictEqual(
        collateralAssets.length,
        2n,
        `Should have 2 collateral assets, got ${collateralAssets.length}`
      );

      // Verify addresses are included
      const hasAlice = collateralAssets.some(
        (addr: string) => addr.toLowerCase() === aliceToken.address.toLowerCase()
      );
      const hasBob = collateralAssets.some(
        (addr: string) => addr.toLowerCase() === bobToken.address.toLowerCase()
      );

      assert.ok(hasAlice, "ALC should be in collateral assets");
      assert.ok(hasBob, "BOB should be in collateral assets");

      console.log(`✅ Test: Verified ${collateralAssets.length} collateral assets`);
    });
  });
});
