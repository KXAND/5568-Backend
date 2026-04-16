import { parseEventLogs } from "viem";
import { network } from "hardhat";
import { deploy } from "./deploy.js";
import { runIncentivesDemo } from "./scenarios/incentives.js";
import { runProtocolFeesDemo } from "./scenarios/protocol_fees.js";

const ONE = 10n ** 18n;
const BOB_PRICE_HEALTHY = 2n * ONE;
const BOB_PRICE_DIRECT_LIQUIDATION = 1n * ONE;
const BOB_PRICE_MULTI_LIQUIDATION = 985_000_000_000_000_000n;

function formatToken(amount: bigint) {
  return (Number(amount) / 1e18).toFixed(4);
}

function printSection(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function assertCondition(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForReceipt(
  publicClient: Awaited<ReturnType<Awaited<ReturnType<typeof network.connect>>["viem"]["getPublicClient"]>>,
  hash: `0x${string}`
) {
  await publicClient.waitForTransactionReceipt({ hash });
}

async function setPrices(
  oracle: any,
  aliceToken: any,
  bobToken: any,
  account: `0x${string}`,
  publicClient: Awaited<ReturnType<Awaited<ReturnType<typeof network.connect>>["viem"]["getPublicClient"]>>,
  bobPrice: bigint
) {
  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([aliceToken.address, ONE], { account })
  );
  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([bobToken.address, bobPrice], { account })
  );
}

async function createDebtVault(
  pool: any,
  bobToken: any,
  borrower: { account: { address: `0x${string}` } },
  collateralAmount: bigint,
  borrowAsset: `0x${string}`,
  borrowAmount: bigint,
  publicClient: Awaited<ReturnType<Awaited<ReturnType<typeof network.connect>>["viem"]["getPublicClient"]>>
) {
  const borrowerAddress = borrower.account.address;
  const debtVaultId = await pool.read.nextDebtVaultId();

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
    await pool.write.depositCollateral([debtVaultId, bobToken.address, collateralAmount], { account: borrowerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.borrow([debtVaultId, borrowAsset, borrowAmount], { account: borrowerAddress })
  );

  return debtVaultId;
}

async function logVaultState(
  pool: any,
  debtVaultId: bigint,
  debtAsset: `0x${string}`,
  label: string
) {
  const debt = await pool.read.getDebtVaultDebtAmount([debtVaultId, debtAsset]);
  const hf = await pool.read.healthFactor([debtVaultId]);
  console.log(label, "debt =", formatToken(debt), "HF =", formatToken(hf));
  return { debt, hf };
}

async function executeFlashLiquidation(
  flashBot: any,
  flashPool: any,
  flashBotAddress: `0x${string}`,
  aliceToken: any,
  bobToken: any,
  debtVaultId: bigint,
  caller: `0x${string}`,
  publicClient: Awaited<ReturnType<Awaited<ReturnType<typeof network.connect>>["viem"]["getPublicClient"]>>,
  borrowAmount: bigint,
  verboseLogs: boolean
) {
  const feeRate = await flashPool.read.feeRate();
  const expectedFee = (borrowAmount * feeRate) / 10_000n;
  const flashPoolBalanceBefore = await flashPool.read.getBalance([aliceToken.address]);
  const botAliceBefore = await aliceToken.read.balanceOf([flashBotAddress]);

  const flashTx = await flashBot.write.borrow(
    [aliceToken.address, borrowAmount, debtVaultId, bobToken.address],
    { account: caller }
  );
  const receipt = await publicClient.waitForTransactionReceipt({ hash: flashTx });

  if (verboseLogs) {
    const botLogs = parseEventLogs({
      abi: flashBot.abi,
      logs: receipt.logs.filter(
        (log: { address: string }) => log.address.toLowerCase() === flashBot.address.toLowerCase()
      ),
      strict: false,
    });

    console.log("Bot execution logs:");
    for (const log of botLogs) {
      if ("eventName" in log && log.eventName === "Log") {
        console.log(" ", log.args.message + ":", log.args.value.toString());
      }
    }
  }

  const flashPoolBalanceAfter = await flashPool.read.getBalance([aliceToken.address]);
  const botAliceAfter = await aliceToken.read.balanceOf([flashBotAddress]);

  assertCondition(
    flashPoolBalanceAfter >= flashPoolBalanceBefore + expectedFee,
    "Flash pool did not receive the expected repayment fee"
  );
  assertCondition(botAliceAfter >= botAliceBefore, "Bot ALC balance unexpectedly decreased");

  return {
    expectedFee,
    flashPoolBalanceBefore,
    flashPoolBalanceAfter,
    botAliceBefore,
    botAliceAfter,
  };
}

async function main() {
  const { viem } = await network.connect({ network: "localhost" });
  const publicClient = await viem.getPublicClient();
  const [A, B, C, D] = await viem.getWalletClients();
  const a = A.account.address;
  const b = B.account.address;
  const c = C.account.address;
  const d = D.account.address;

  const deployed = await deploy({ viem });

  const oracle = await viem.getContractAt("SimpleOracle", deployed.oracle);
  const aliceFaucet = await viem.getContractAt("AliceFaucet", deployed.aliceFaucet);
  const bobFaucet = await viem.getContractAt("BobFaucet", deployed.bobFaucet);
  const aliceToken = await viem.getContractAt("AliceToken", deployed.aliceToken);
  const bobToken = await viem.getContractAt("BobToken", deployed.bobToken);
  const pool = await viem.getContractAt("LendingPool", deployed.pool);
  const flashPool = await viem.getContractAt("FlashLoanPool", deployed.flashPool);
  const flashSwap = await viem.getContractAt("FlashLoanSwap", deployed.flashSwap);
  const flashBot = await viem.getContractAt("FlashLoanBot", deployed.flashBot);

  printSection("Part 1: Setup Reserves and Flash Contracts");

  await setPrices(oracle, aliceToken, bobToken, a, publicClient, BOB_PRICE_HEALTHY);

  await waitForReceipt(publicClient, await aliceFaucet.write.claim({ account: a }));
  await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: a }));
  await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: b }));
  await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: c }));
  await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: d }));

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

  printSection("Part 2: Direct Liquidation");

  const directVaultId = await createDebtVault(
    pool,
    bobToken,
    B,
    100n * ONE,
    aliceToken.address,
    100n * ONE,
    publicClient
  );
  await logVaultState(pool, directVaultId, aliceToken.address, "Before crash");
  await setPrices(
    oracle,
    aliceToken,
    bobToken,
    a,
    publicClient,
    BOB_PRICE_DIRECT_LIQUIDATION
  );
  const directBefore = await logVaultState(pool, directVaultId, aliceToken.address, "After crash");
  assertCondition(directBefore.hf < ONE, "Direct liquidation vault is not liquidatable");

  const directRepayAmount = 100n * ONE;
  const directClaimableBefore = await pool.read.getUserClaimableShares([a, bobToken.address]);
  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([pool.address, directRepayAmount], { account: a })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.liquidate([directVaultId, aliceToken.address, bobToken.address, directRepayAmount], { account: a })
  );
  const directAfter = await logVaultState(pool, directVaultId, aliceToken.address, "After direct liquidation");
  const directClaimableAfter = await pool.read.getUserClaimableShares([a, bobToken.address]);
  const directSeizedShares = directClaimableAfter - directClaimableBefore;
  console.log("Direct liquidator seized shares:", directSeizedShares.toString());
  assertCondition(directAfter.debt < directBefore.debt, "Direct liquidation did not reduce debt");

  printSection("Part 3: Single Flash Loan Liquidation");

  await setPrices(oracle, aliceToken, bobToken, a, publicClient, BOB_PRICE_HEALTHY);
  const flashVaultId = await createDebtVault(
    pool,
    bobToken,
    C,
    100n * ONE,
    aliceToken.address,
    100n * ONE,
    publicClient
  );
  await setPrices(
    oracle,
    aliceToken,
    bobToken,
    a,
    publicClient,
    BOB_PRICE_DIRECT_LIQUIDATION
  );
  const flashBefore = await logVaultState(pool, flashVaultId, aliceToken.address, "Before flash liquidation");
  assertCondition(flashBefore.hf < ONE, "Flash liquidation vault is not liquidatable");

  const singleFlash = await executeFlashLiquidation(
    flashBot,
    flashPool,
    flashBot.address,
    aliceToken,
    bobToken,
    flashVaultId,
    a,
    publicClient,
    100n * ONE,
    true
  );
  const flashAfter = await logVaultState(pool, flashVaultId, aliceToken.address, "After flash liquidation");
  const botBobClaimableShares = await pool.read.getUserClaimableShares([flashBot.address, bobToken.address]);
  console.log("Flash pool fee earned:", formatToken(singleFlash.flashPoolBalanceAfter - singleFlash.flashPoolBalanceBefore), "ALC");
  console.log("Bot ALC after single flash:", formatToken(singleFlash.botAliceAfter));
  console.log("Bot remaining claimable BOB shares:", botBobClaimableShares.toString());
  assertCondition(flashAfter.debt < flashBefore.debt, "Flash liquidation did not reduce debt");

  printSection("Part 4: Repeated Flash Liquidations Until Healthy");

  await setPrices(oracle, aliceToken, bobToken, a, publicClient, BOB_PRICE_HEALTHY);
  const multiVaultId = await createDebtVault(
    pool,
    bobToken,
    D,
    100n * ONE,
    aliceToken.address,
    90n * ONE,
    publicClient
  );
  await setPrices(
    oracle,
    aliceToken,
    bobToken,
    a,
    publicClient,
    BOB_PRICE_MULTI_LIQUIDATION
  );

  let iteration = 0;
  let multiState = await logVaultState(pool, multiVaultId, aliceToken.address, "Initial multi-liquidation state");
  assertCondition(multiState.hf < ONE, "Multi-liquidation vault is already healthy");

  while (multiState.hf < ONE) {
    iteration += 1;
    const currentDebt = await pool.read.getDebtVaultDebtAmount([multiVaultId, aliceToken.address]);
    console.log("Iteration", iteration, "flash borrow amount:", formatToken(currentDebt), "ALC");

    await executeFlashLiquidation(
      flashBot,
      flashPool,
      flashBot.address,
      aliceToken,
      bobToken,
      multiVaultId,
      a,
      publicClient,
      currentDebt,
      false
    );

    multiState = await logVaultState(
      pool,
      multiVaultId,
      aliceToken.address,
      `State after flash liquidation ${iteration}`
    );

    assertCondition(iteration < 10, "Too many flash liquidations without restoring health");
  }

  console.log("Vault restored healthy after", iteration, "flash liquidations");
  console.log("Final healthy HF:", formatToken(multiState.hf));

  printSection("Part 5: Pool Incentives Demo");
  await runIncentivesDemo({
    viem,
    publicClient,
    deployed,
    pool,
    oracle,
    aliceToken,
    bobToken,
    borrowerClient: B,
    ownerAddress: a,
    one: ONE,
    healthyBobPrice: BOB_PRICE_HEALTHY,
    waitForReceipt,
    setPrices,
    createDebtVault,
  });

  printSection("Part 6: Protocol Fee Demo");
  await runProtocolFeesDemo({
    pool,
    publicClient,
    aliceToken,
    bobToken,
    oracle,
    ownerAddress: a,
    treasuryAddress: b,
    borrowerClient: C,
    one: ONE,
    healthyBobPrice: BOB_PRICE_HEALTHY,
    waitForReceipt,
    setPrices,
    createDebtVault,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


