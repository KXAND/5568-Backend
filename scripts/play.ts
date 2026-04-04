import { network } from "hardhat";
import { deploy } from "./deploy.js";

async function main() {
  const { viem } = await network.connect({ network: "localhost" });
  const [A] = await viem.getWalletClients();
  const account = A.account.address;

  const deployed = await deploy();

  const oracle = await viem.getContractAt("SimpleOracle", deployed.oracle);
  const aliceFaucet = await viem.getContractAt("AliceFaucet", deployed.aliceFaucet);
  const bobFaucet = await viem.getContractAt("BobFaucet", deployed.bobFaucet);
  const aliceToken = await viem.getContractAt("AliceToken", deployed.aliceToken);
  const bobToken = await viem.getContractAt("BobToken", deployed.bobToken);
  const pool = await viem.getContractAt("LendingPool", deployed.pool);

  await oracle.write.setPrice([aliceToken.address, 1n * 10n ** 18n], { account });
  await oracle.write.setPrice([bobToken.address, 2n * 10n ** 18n], { account });

  await aliceFaucet.write.claim({ account });
  await bobFaucet.write.claim({ account });

  const supplyAmount = 10_000n * 10n ** 18n;
  await aliceToken.write.approve([pool.address, supplyAmount], { account });
  await pool.write.deposit([aliceToken.address, supplyAmount], { account });

  const nextDebtVaultId = await pool.read.nextDebtVaultId();
  await pool.write.openDebtVault({ account });

  const collateralAmount = 1_000n * 10n ** 18n;
  await bobToken.write.approve([pool.address, collateralAmount], { account });
  await pool.write.deposit([bobToken.address, collateralAmount], { account });
  await pool.write.depositCollateral([nextDebtVaultId, bobToken.address, collateralAmount], { account });

  const borrowAmount = 1_000n * 10n ** 18n;
  await pool.write.borrow([nextDebtVaultId, aliceToken.address, borrowAmount], { account });

  const repayAmount = 200n * 10n ** 18n;
  await aliceToken.write.approve([pool.address, repayAmount], { account });
  await pool.write.repay([nextDebtVaultId, aliceToken.address, repayAmount], { account });

  const aliceBalance = await aliceToken.read.balanceOf([account]);
  const bobBalance = await bobToken.read.balanceOf([account]);
  const hf = await pool.read.healthFactor([nextDebtVaultId]);
  const aliceCustodiedShares = await pool.read.getUserCustodiedShares([account, aliceToken.address]);
  const aliceDepositedAmount = await pool.read.getDebtVaultCollateralAssetAmount([nextDebtVaultId, aliceToken.address]);
  const bobLockedShares = await pool.read.getUserLockedShares([account, bobToken.address]);
  const debtBalance = await pool.read.getDebtVaultDebtAmount([nextDebtVaultId, aliceToken.address]);

  console.log("ALC balance:", aliceBalance.toString());
  console.log("BOB balance:", bobBalance.toString());
  console.log("ALC custodied shares:", aliceCustodiedShares.toString());
  console.log("ALC deposited asset amount:", aliceDepositedAmount.toString());
  console.log("BOB locked shares:", bobLockedShares.toString());
  console.log("Debt balance:", debtBalance.toString());
  console.log("HF:", hf.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
