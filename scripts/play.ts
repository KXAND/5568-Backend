import path from "node:path";
import { network } from "hardhat";

import { deploy } from "../test/scenarios/deploy.js";

async function waitForReceipt(publicClient: any, hash: `0x${string}`) {
  await publicClient.waitForTransactionReceipt({ hash });
}

async function setPrices(
  oracle: any,
  aliceToken: any,
  bobToken: any,
  account: `0x${string}`,
  publicClient: any,
  bobPrice: bigint,
  alicePrice: bigint,
) {
  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([aliceToken.address, alicePrice], { account })
  );
  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([bobToken.address, bobPrice], { account })
  );
}

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, borrower] = await viem.getWalletClients();
  const ownerAddress = owner.account.address;
  const borrowerAddress = borrower.account.address;

  const deployed = await deploy({ viem, log: false });
  const oracle = await viem.getContractAt("SimpleOracle", deployed.oracle);
  const aliceFaucet = await viem.getContractAt("AliceFaucet", deployed.aliceFaucet);
  const bobFaucet = await viem.getContractAt("BobFaucet", deployed.bobFaucet);
  const aliceToken = await viem.getContractAt("AliceToken", deployed.aliceToken);
  const bobToken = await viem.getContractAt("BobToken", deployed.bobToken);
  const pool = await viem.getContractAt("LendingPool", deployed.pool);

  await setPrices(oracle, aliceToken, bobToken, ownerAddress, publicClient, 2n * 10n ** 18n, 1n * 10n ** 18n);

  await waitForReceipt(publicClient, await aliceFaucet.write.claim({ account: ownerAddress }));
  await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: borrowerAddress }));

  const reserveLiquidity = 1_000n * 10n ** 18n;
  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([pool.address, reserveLiquidity], { account: ownerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.deposit([aliceToken.address, reserveLiquidity], { account: ownerAddress })
  );

  const vaultId = await pool.read.nextDebtVaultId();
  const collateralAmount = 100n * 10n ** 18n;
  const borrowAmount = 50n * 10n ** 18n;

  await waitForReceipt(publicClient, await pool.write.openDebtVault({ account: borrowerAddress }));
  await waitForReceipt(
    publicClient,
    await bobToken.write.approve([pool.address, collateralAmount], { account: borrowerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.deposit([bobToken.address, collateralAmount], { account: borrowerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.depositCollateral([vaultId, bobToken.address, collateralAmount], { account: borrowerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.borrow([vaultId, aliceToken.address, borrowAmount], { account: borrowerAddress })
  );

  const debt = await pool.read.getDebtVaultDebtAmount([vaultId, aliceToken.address]);
  const hf = await pool.read.healthFactor([vaultId]);
  const borrowerAliceBalance = await aliceToken.read.balanceOf([borrowerAddress]);

  console.log("script =", path.basename(process.argv[1] ?? "play.ts"));
  console.log("owner =", ownerAddress);
  console.log("borrower =", borrowerAddress);
  console.log("pool =", deployed.pool);
  console.log("vaultId =", vaultId.toString());
  console.log("debt =", debt.toString());
  console.log("healthFactor =", hf.toString());
  console.log("borrowerAliceBalance =", borrowerAliceBalance.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
