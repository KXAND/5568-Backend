import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";
import { deploy } from "../scripts/deploy.js";

// this is a example test case. please following this code style.
describe("LendingPool Collateral Flow (integration)", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [_, carol] = await viem.getWalletClients();

  let pool: any;
  let bob: any;
  let faucet: any;

  before(async () => {
    const deployed = await deploy();

    pool = await viem.getContractAt("LendingPool", deployed.pool);
    bob = await viem.getContractAt("BobToken", deployed.bobToken);
    faucet = await viem.getContractAt("BobFaucet", deployed.bobFaucet);
  });

  it("should deposit 3+3 and withdraw 6", async function () {
    const ONE = 10n ** 18n;

    // prepares
    await faucet.write.claim({ account: carol.account });

    await bob.write.approve([pool.address, 6n * ONE], {
      account: carol.account,
    });

    await pool.write.deposit([bob.address, 6n * ONE], {
      account: carol.account,
    });

    const vaultId = await pool.read.nextDebtVaultId();
    await pool.write.openDebtVault({ account: carol.account });

    for (let i = 0; i < 10; i++) {
      // deposit
      await pool.write.depositCollateral(
        [vaultId, bob.address, 3n * ONE],
        { account: carol.account }
      );

      await pool.write.depositCollateral(
        [vaultId, bob.address, 3n * ONE],
        { account: carol.account }
      );

      const afterDeposit =
        await pool.read.getDebtVaultCollateralAssetAmount([
          vaultId,
          bob.address,
        ]);

      assert.equal(afterDeposit, 6n * ONE);

      // withdraw
      await pool.write.withdrawCollateral(
        [vaultId, bob.address, 6n * ONE],
        { account: carol.account }
      );

      const afterWithdraw =
        await pool.read.getDebtVaultCollateralAssetAmount([
          vaultId,
          bob.address,
        ]);

      assert.equal(afterWithdraw, 0n);
    }
  });
});