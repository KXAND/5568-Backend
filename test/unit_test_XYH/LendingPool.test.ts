import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network, viem } from "hardhat";

const LIBRARIES = {
  reserve: "project/contracts/logic/ReserveLogic.sol:ReserveLogic",
  debtVault: "project/contracts/logic/DebtVaultLogic.sol:DebtVaultLogic",
  config: "project/contracts/logic/ConfigLogic.sol:ConfigLogic",
  supply: "project/contracts/logic/DepositLogic.sol:DepositLogic",
  borrow: "project/contracts/logic/BorrowLogic.sol:BorrowLogic",
} as const;

describe("LendingPool", async function () {
  const { viem: viemInstance } = await network.connect();
  const [owner, user1, user2, liquidator] = await viemInstance.getWalletClients();

  let pool: any;
  let oracle: any;
  let aliceToken: any;
  let bobToken: any;
  let aliceFaucet: any;
  let bobFaucet: any;
  let poolIncentivesController: any;

  const ONE = 10n ** 18n;
  const RAY = 10n ** 18n;
  const BPS = 10000n;

  before(async () => {
    // 部署 Oracle (SimpleOracle 构造函数不接受参数)
    oracle = await viemInstance.deployContract("SimpleOracle", [], { client: { wallet: owner } });

    // 部署 InterestRateModel
    const baseRate = 0n;
    const slope1 = 5_000_000_000_000_000n; // 5%
    const slope2 = 20_000_000_000_000_000n; // 20%
    const kink = 800_000_000_000_000_000n; // 80%
    const irm = await viemInstance.deployContract(
      "InterestRateModel",
      [baseRate, slope1, slope2, kink],
      { client: { wallet: owner } }
    );

    // 部署 AliceFaucet 和获取 AliceToken
    aliceFaucet = await viemInstance.deployContract(
      "AliceFaucet",
      [1_000_000n * ONE, 100_000n * ONE, 60n],
      { client: { wallet: owner } }
    );
    aliceToken = await viemInstance.getContractAt("AliceToken", await aliceFaucet.read.token());

    // 部署 BobFaucet 和获取 BobToken
    bobFaucet = await viemInstance.deployContract(
      "BobFaucet",
      [1_000_000n * ONE, 100_000n * ONE, 60n],
      { client: { wallet: owner } }
    );
    bobToken = await viemInstance.getContractAt("BobToken", await bobFaucet.read.token());

    // 部署 PoolCoin
    const poolCoin = await viemInstance.deployContract(
      "PoolCoin",
      [owner.account.address, 1_919_810n * ONE],
      { client: { wallet: owner } }
    );

    // 部署 PoolIncentivesController
    poolIncentivesController = await viemInstance.deployContract(
      "PoolIncentivesController",
      [poolCoin.address, owner.account.address, owner.account.address],
      { client: { wallet: owner } }
    );

    // 部署 ReserveLogic
    const reserveLogic = await viemInstance.deployContract("ReserveLogic", [], {
      client: { wallet: owner },
    });

    // 部署 DebtVaultLogic
    const debtVaultLogic = await viemInstance.deployContract("DebtVaultLogic", [], {
      client: { wallet: owner },
      libraries: {
        [LIBRARIES.reserve]: reserveLogic.address,
      },
    });

    // 部署 ConfigLogic
    const configLogic = await viemInstance.deployContract("ConfigLogic", [], {
      client: { wallet: owner },
    });

    // 部署 DepositLogic
    const depositLogic = await viemInstance.deployContract("DepositLogic", [], {
      client: { wallet: owner },
      libraries: {
        [LIBRARIES.reserve]: reserveLogic.address,
      },
    });

    // 部署 BorrowLogic
    const borrowLogic = await viemInstance.deployContract("BorrowLogic", [], {
      client: { wallet: owner },
      libraries: {
        [LIBRARIES.reserve]: reserveLogic.address,
      },
    });

    // 部署 LendingPool
    pool = await viemInstance.deployContract("LendingPool", [oracle.address], {
      client: { wallet: owner },
      libraries: {
        [LIBRARIES.reserve]: reserveLogic.address,
        [LIBRARIES.debtVault]: debtVaultLogic.address,
        [LIBRARIES.config]: configLogic.address,
        [LIBRARIES.supply]: depositLogic.address,
        [LIBRARIES.borrow]: borrowLogic.address,
      },
    });

    // 添加储备资产
    // Alice: 不能作为抵押品，可以借贷
    await pool.write.addReserve(
      [aliceToken.address, irm.address, false, true, 0n, 0n, "Pool Alice", "pALC"],
      { account: owner.account.address }
    );

    // Bob: 可以作为抵押品，不能借贷
    await pool.write.addReserve(
      [
        bobToken.address,
        irm.address,
        true,
        false,
        750_000_000_000_000_000n, // 75% LTV
        850_000_000_000_000_000n, // 85% liquidation threshold
        "Pool Bob",
        "pBOB",
      ],
      { account: owner.account.address }
    );

    // 设置价格
    await oracle.write.setPrice([aliceToken.address, ONE], { account: owner.account.address });
    await oracle.write.setPrice([bobToken.address, ONE], { account: owner.account.address });

    // 设置 PoolIncentivesController
    await pool.write.setPoolIncentivesController([poolIncentivesController.address], {
      account: owner.account.address,
    });
  });

  describe("Reserve Configuration", function () {
    it("should add reserves correctly", async function () {
      const reserveAssets = await pool.read.getReserveAssets();
      assert.equal(reserveAssets.length, 2);
    });

    it("should allow owner to set reserve config", async function () {
      await pool.write.setReserveConfig(
        [bobToken.address, true, false, 800_000_000_000_000_000n, 900_000_000_000_000_000n],
        { account: owner.account.address }
      );
      // 配置更新成功，无异常
    });

    it("should reject ltv > liquidationThreshold", async function () {
      await assert.rejects(
        pool.write.setReserveConfig(
          [bobToken.address, true, false, 900_000_000_000_000_000n, 800_000_000_000_000_000n],
          { account: owner.account.address }
        )
      );
    });

    it("should allow owner to set liquidation bonus", async function () {
      await pool.write.setLiquidationBonus([1000n], { account: owner.account.address }); // 10%
      const bonus = await pool.read.liquidationBonus();
      assert.equal(bonus, 1000n);
    });

    it("should reject liquidation bonus too high", async function () {
      await assert.rejects(
        pool.write.setLiquidationBonus([5000n], { account: owner.account.address }) // 50% > 30%
      );
    });

    it("should allow owner to set close factor", async function () {
      await pool.write.setCloseFactor([3000n], { account: owner.account.address }); // 30%
      const closeFactor = await pool.read.closeFactor();
      assert.equal(closeFactor, 3000n);
    });

    it("should reject close factor > 100%", async function () {
      await assert.rejects(
        pool.write.setCloseFactor([BPS + 1n], { account: owner.account.address })
      );
    });
  });

  describe("Oracle Configuration", function () {
    it("should set oracle correctly", async function () {
      const newOracle = await viemInstance.deployContract("SimpleOracle", []);
      await pool.write.setOracle([newOracle.address], { account: owner.account.address });
      // 设置成功，无异常
    });

    it("should set interest rate model correctly", async function () {
      const newIrm = await viemInstance.deployContract(
        "InterestRateModel",
        [0n, 4_000_000_000_000_000n, 10_000_000_000_000_000n, 700_000_000_000_000_000n],
        { client: { wallet: owner } }
      );
      await pool.write.setInterestRateModel([bobToken.address, newIrm.address], {
        account: owner.account.address,
      });
      // 设置成功，无异常
    });
  });

  describe("Deposit and Withdraw", function () {
    before(async () => {
      // 给 user1 一些 BobToken
      await bobFaucet.write.claim({ account: user1.account.address });

      // user1 授权 pool 使用 BobToken
      await bobToken.write.approve([pool.address, 100n * ONE], { account: user1.account.address });
    });

    it("should allow deposit", async function () {
      const initialBalance = await bobToken.read.balanceOf([pool.address]);

      await pool.write.deposit([bobToken.address, 10n * ONE], { account: user1.account.address });

      const finalBalance = await bobToken.read.balanceOf([pool.address]);
      assert.equal(finalBalance, initialBalance + 10n * ONE);
    });

    it("should track user custodied shares", async function () {
      const shares = await pool.read.getUserCustodiedShares([user1.account.address, bobToken.address]);
      assert.ok(shares > 0n);
    });
  });

  describe("Debt Vault Operations", function () {
    before(async () => {
      // 给 user2 一些 BobToken 作为抵押品
      await bobFaucet.write.claim({ account: user2.account.address });

      // user2 授权 pool
      await bobToken.write.approve([pool.address, 100n * ONE], { account: user2.account.address });

      // user2 先存款
      await pool.write.deposit([bobToken.address, 10n * ONE], { account: user2.account.address });
    });

    it("should open debt vault", async function () {
      const initialNextId = await pool.read.nextDebtVaultId();

      await pool.write.openDebtVault({ account: user2.account.address });

      const newNextId = await pool.read.nextDebtVaultId();
      assert.equal(newNextId, initialNextId + 1n);
    });

    it("should deposit collateral", async function () {
      const vaultId = 1n;

      const initialCollateral = await pool.read.getDebtVaultCollateralAssetAmount([vaultId, bobToken.address]);

      await pool.write.depositCollateral([vaultId, bobToken.address, 5n * ONE], {
        account: user2.account.address,
      });

      const finalCollateral = await pool.read.getDebtVaultCollateralAssetAmount([vaultId, bobToken.address]);
      assert.equal(finalCollateral, initialCollateral + 5n * ONE);
    });

    it("should track collateral assets in vault", async function () {
      const vaultId = 1n;
      const collateralAssets = await pool.read.getDebtVaultCollateralAssets([vaultId]);
      assert.ok(collateralAssets.length > 0);
    });
  });

  describe("Get Reserve Data", function () {
    it("should get reserve aToken", async function () {
      const aTokenAddress = await pool.read.getReserveAToken([bobToken.address]);
      assert.ok(aTokenAddress !== "0x0000000000000000000000000000000000000000");
    });

    it("should get reserve utilization", async function () {
      const utilization = await pool.read.getReserveUtilization([bobToken.address]);
      assert.ok(utilization >= 0n);
    });

    it("should get owner debt vault ids", async function () {
      const vaultIds = await pool.read.getOwnerDebtVaultIds([user2.account.address]);
      assert.ok(vaultIds.length > 0);
    });
  });

  describe("Access Control", function () {
    it("should reject non-owner to add reserve", async function () {
      const fakeIrm = await viemInstance.deployContract(
        "InterestRateModel",
        [0n, 4_000_000_000_000_000n, 10_000_000_000_000_000n, 700_000_000_000_000_000n],
        { client: { wallet: owner } }
      );

      await assert.rejects(
        pool.write.addReserve(
          [aliceToken.address, fakeIrm.address, false, true, 0n, 0n, "Test", "TST"],
          { account: user1.account.address }
        )
      );
    });

    it("should reject non-owner to set oracle", async function () {
      const newOracle = await viemInstance.deployContract("SimpleOracle", []);
      await assert.rejects(
        pool.write.setOracle([newOracle.address], { account: user1.account.address })
      );
    });

    it("should reject non-owner to set liquidation bonus", async function () {
      await assert.rejects(
        pool.write.setLiquidationBonus([1000n], { account: user1.account.address })
      );
    });
  });

  describe("User Data Queries", function () {
    it("should get user locked shares", async function () {
      const lockedShares = await pool.read.getUserLockedShares([user2.account.address, bobToken.address]);
      assert.ok(lockedShares >= 0n);
    });

    it("should get user claimable shares", async function () {
      const claimableShares = await pool.read.getUserClaimableShares([user2.account.address, bobToken.address]);
      assert.ok(claimableShares >= 0n);
    });

    it("should get user debt principal", async function () {
      const debtPrincipal = await pool.read.getUserDebtPrincipal([user1.account.address, aliceToken.address]);
      assert.ok(debtPrincipal >= 0n);
    });

    it("should get user debt balance", async function () {
      const debtBalance = await pool.read.getUserDebtBalance([user1.account.address, aliceToken.address]);
      assert.ok(debtBalance >= 0n);
    });
  });
});
