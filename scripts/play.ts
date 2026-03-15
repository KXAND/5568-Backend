// scripts/play.ts
import { network } from "hardhat";
import { deploy } from "./deploy.js"

async function main() {
  const { viem } = await network.connect({ network: "localhost" });
  const publicClient = await viem.getPublicClient();
  const [A, B] = await viem.getWalletClients();
  const a = A.account.address;

  // Fill these with your deployed addresses
  const [ORACLE, , ALICE_FAUCET, , BOB_FAUCET, , POOL] = await deploy()


  const oracle = await viem.getContractAt("SimpleOracle", ORACLE);
  const aliceFaucet = await viem.getContractAt("AliceFaucet", ALICE_FAUCET);
  const bobFaucet = await viem.getContractAt("BobFaucet", BOB_FAUCET);
  const pool = await viem.getContractAt("LendingPool", POOL);

  const aliceToken = await viem.getContractAt(
    "AliceToken",
    await aliceFaucet.read.token()
  );
  const bobToken = await viem.getContractAt(
    "BobToken",
    await bobFaucet.read.token()
  );

  // Set oracle prices (1e18 scale)
  await oracle.write.setPrice([bobToken.address, 2n * 10n ** 18n], { account: a });
  await oracle.write.setPrice([aliceToken.address, 1n * 10n ** 18n], { account: a });

  // Claim faucet tokens for A,B; drip: 100_000
  await bobFaucet.write.claim({ account: a });
  await aliceFaucet.write.claim({ account: a });

  // Provide borrow liquidity to pool (A transfers AliceToken to pool)
  const liquidity = 5_000n * 10n ** 18n;
  await aliceToken.write.transfer([pool.address, liquidity], { account: a });

  // Deposit collateral (BobToken) 
  const depositAmount = 1_000n * 10n ** 18n;
  await bobToken.write.approve([pool.address, depositAmount], { account: a });
  await pool.write.deposit([depositAmount], { account: a });

  // Borrow AliceToken: 1_000 BOBB = 2000ALC, LTV= 0.75, maxBrw = 1500
  const borrowAmount = 1000n * 10n ** 18n;
  await pool.write.borrow([borrowAmount], { account: a });

  // Repay part of the debt
  const repayAmount = 200n * 10n ** 18n;
  await aliceToken.write.approve([pool.address, repayAmount], { account: a });
  await pool.write.repay([repayAmount], { account: a });

  // Check balances
  const aAlice = await aliceToken.read.balanceOf([a]);
  const aBob = await bobToken.read.balanceOf([a]);
  const hf = await pool.read.healthFactor([a]);

  console.log("A AliceToken:", aAlice.toString());
  console.log("A BobToken:", aBob.toString());
  console.log("HealthFactor:", hf.toString());

  await publicClient.getBlockNumber(); // keep linter quiet if needed
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
