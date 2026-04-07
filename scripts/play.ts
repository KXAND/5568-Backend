import { parseEventLogs } from "viem";
import { network } from "hardhat";
import { deploy } from "./deploy.js";

const ONE = 10n ** 18n;

function formatToken(amount: bigint) {
  return (Number(amount) / 1e18).toFixed(4);
}

async function waitForReceipt(
  publicClient: Awaited<ReturnType<Awaited<ReturnType<typeof network.connect>>["viem"]["getPublicClient"]>>,
  hash: `0x${string}`
) {
  await publicClient.waitForTransactionReceipt({ hash });
}

async function main() {
  const { viem } = await network.connect({ network: "localhost" });
  const publicClient = await viem.getPublicClient();
  const [A, B] = await viem.getWalletClients();
  const a = A.account.address;
  const b = B.account.address;

  const deployed = await deploy();

  const oracle = await viem.getContractAt("SimpleOracle", deployed.oracle);
  const aliceFaucet = await viem.getContractAt("AliceFaucet", deployed.aliceFaucet);
  const bobFaucet = await viem.getContractAt("BobFaucet", deployed.bobFaucet);
  const aliceToken = await viem.getContractAt("AliceToken", deployed.aliceToken);
  const bobToken = await viem.getContractAt("BobToken", deployed.bobToken);
  const pool = await viem.getContractAt("LendingPool", deployed.pool);
  const flashPool = await viem.getContractAt("FlashLoanPool", deployed.flashPool);
  const flashSwap = await viem.getContractAt("FlashLoanSwap", deployed.flashSwap);
  const flashBot = await viem.getContractAt("FlashLoanBot", deployed.flashBot);

  console.log("\n" + "=".repeat(60));
  console.log("Part 1: Setup Reserves and Flash Contracts");
  console.log("=".repeat(60));

  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([aliceToken.address, 1n * ONE], { account: a })
  );
  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([bobToken.address, 2n * ONE], { account: a })
  );

  await waitForReceipt(publicClient, await aliceFaucet.write.claim({ account: a }));
  await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: a }));
  await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: b }));

  const reserveLiquidity = 5_000n * ONE;
  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([pool.address, reserveLiquidity], { account: a })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.deposit([aliceToken.address, reserveLiquidity], { account: a })
  );
  console.log("Reserve liquidity funded:", formatToken(reserveLiquidity), "ALC");

  const flashLiquidity = 1_000n * ONE;
  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([flashPool.address, flashLiquidity], { account: a })
  );
  await waitForReceipt(
    publicClient,
    await flashPool.write.deposit([aliceToken.address, flashLiquidity], { account: a })
  );
  console.log("Flash pool funded:", formatToken(flashLiquidity), "ALC");

  const swapLiquidity = 1_000n * ONE;
  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([flashSwap.address, swapLiquidity], { account: a })
  );
  await waitForReceipt(
    publicClient,
    await bobToken.write.approve([flashSwap.address, swapLiquidity], { account: a })
  );
  await waitForReceipt(
    publicClient,
    await flashSwap.write.addLiquidity([aliceToken.address, swapLiquidity], { account: a })
  );
  await waitForReceipt(
    publicClient,
    await flashSwap.write.addLiquidity([bobToken.address, swapLiquidity], { account: a })
  );
  console.log("Swap liquidity funded:", formatToken(swapLiquidity), "ALC and BOB");

  console.log("\n" + "=".repeat(60));
  console.log("Part 2: Create Liquidatable Vault");
  console.log("=".repeat(60));

  const debtVaultId = await pool.read.nextDebtVaultId();
  await waitForReceipt(publicClient, await pool.write.openDebtVault({ account: b }));

  const collateralAmount = 100n * ONE;
  await waitForReceipt(
    publicClient,
    await bobToken.write.approve([pool.address, collateralAmount], { account: b })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.deposit([bobToken.address, collateralAmount], { account: b })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.depositCollateral([debtVaultId, bobToken.address, collateralAmount], { account: b })
  );

  const borrowAmount = 100n * ONE;
  await waitForReceipt(
    publicClient,
    await pool.write.borrow([debtVaultId, aliceToken.address, borrowAmount], { account: b })
  );

  const debtBefore = await pool.read.getDebtVaultDebtAmount([debtVaultId, aliceToken.address]);
  const hfBeforeCrash = await pool.read.healthFactor([debtVaultId]);
  console.log("Vault ID:", debtVaultId.toString());
  console.log("Debt before crash:", formatToken(debtBefore), "ALC");
  console.log("HF before crash:", formatToken(hfBeforeCrash));

  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([bobToken.address, 1n * ONE], { account: a })
  );

  const hfAfterCrash = await pool.read.healthFactor([debtVaultId]);
  console.log("HF after crash:", formatToken(hfAfterCrash));

  if (hfAfterCrash >= ONE) {
    throw new Error("Vault is not liquidatable after price crash");
  }

  console.log("\n" + "=".repeat(60));
  console.log("Part 3: Flash Loan Liquidation");
  console.log("=".repeat(60));

  const flashBorrowAmount = 100n * ONE;
  const feeRate = await flashPool.read.feeRate();
  const expectedFee = (flashBorrowAmount * feeRate) / 10_000n;
  const flashPoolBalanceBefore = await flashPool.read.getBalance([aliceToken.address]);
  const botAliceBefore = await aliceToken.read.balanceOf([flashBot.address]);
  const botBobBefore = await bobToken.read.balanceOf([flashBot.address]);

  console.log("Flash borrow:", formatToken(flashBorrowAmount), "ALC");
  console.log("Expected fee:", formatToken(expectedFee), "ALC");

  const flashTx = await flashBot.write.borrow(
    [aliceToken.address, flashBorrowAmount, debtVaultId, bobToken.address],
    { account: a }
  );
  const receipt = await publicClient.waitForTransactionReceipt({ hash: flashTx });

  const botLogs = parseEventLogs({
    abi: flashBot.abi,
    logs: receipt.logs.filter(
      (log) => log.address.toLowerCase() === flashBot.address.toLowerCase()
    ),
    strict: false,
  });

  console.log("Bot execution logs:");
  for (const log of botLogs) {
    if ("eventName" in log && log.eventName === "Log") {
      console.log(" ", log.args.message + ":", log.args.value.toString());
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Part 4: Verify Repay and Profit");
  console.log("=".repeat(60));

  const debtAfter = await pool.read.getDebtVaultDebtAmount([debtVaultId, aliceToken.address]);
  const hfAfterLiquidation = await pool.read.healthFactor([debtVaultId]);
  const flashPoolBalanceAfter = await flashPool.read.getBalance([aliceToken.address]);
  const botAliceAfter = await aliceToken.read.balanceOf([flashBot.address]);
  const botBobAfter = await bobToken.read.balanceOf([flashBot.address]);
  const botClaimableBobShares = await pool.read.getUserClaimableShares([flashBot.address, bobToken.address]);
  const borrowerBobLockedShares = await pool.read.getUserLockedShares([b, bobToken.address]);

  console.log("Debt after liquidation:", formatToken(debtAfter), "ALC");
  console.log("HF after liquidation:", formatToken(hfAfterLiquidation));
  console.log("Flash pool ALC before:", formatToken(flashPoolBalanceBefore));
  console.log("Flash pool ALC after:", formatToken(flashPoolBalanceAfter));
  console.log("Flash pool fee earned:", formatToken(flashPoolBalanceAfter - flashPoolBalanceBefore), "ALC");
  console.log("Bot ALC before:", formatToken(botAliceBefore));
  console.log("Bot ALC after:", formatToken(botAliceAfter));
  console.log("Bot BOB before:", formatToken(botBobBefore));
  console.log("Bot BOB after:", formatToken(botBobAfter));
  console.log("Bot remaining claimable BOB shares:", botClaimableBobShares.toString());
  console.log("Borrower remaining locked BOB shares:", borrowerBobLockedShares.toString());

  if (debtAfter >= debtBefore) {
    throw new Error("Liquidation did not reduce debt");
  }

  if (flashPoolBalanceAfter < flashPoolBalanceBefore + expectedFee) {
    throw new Error("Flash pool did not receive the expected repayment fee");
  }

  console.log("\nFlashloan flow validated: borrow -> liquidation -> swap -> repayment");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
