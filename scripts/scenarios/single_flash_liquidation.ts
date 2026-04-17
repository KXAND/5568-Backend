import { parseEventLogs } from "viem";

async function executeFlashLiquidation(
  flashBot: any,
  flashPool: any,
  flashBotAddress: `0x${string}`,
  aliceToken: any,
  bobToken: any,
  debtVaultId: bigint,
  caller: `0x${string}`,
  publicClient: any,
  borrowAmount: bigint,
  verboseLogs: boolean,
  assertCondition: (condition: boolean, message: string) => void
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
        const args = log.args as { message?: string; value?: bigint };
        if (typeof args.message === "string" && typeof args.value === "bigint") {
          console.log(" ", args.message + ":", args.value.toString());
        }
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

export async function runSingleFlashLiquidationDemo(params: {
  pool: any;
  oracle: any;
  aliceToken: any;
  bobToken: any;
  flashPool: any;
  flashBot: any;
  borrowerClient: any;
  ownerAddress: `0x${string}`;
  healthyBobPrice: bigint;
  directLiquidationBobPrice: bigint;
  one: bigint;
  publicClient: any;
  formatToken: (amount: bigint) => string;
  assertCondition: (condition: boolean, message: string) => void;
  setPrices: (
    oracle: any,
    aliceToken: any,
    bobToken: any,
    account: `0x${string}`,
    publicClient: any,
    bobPrice: bigint
  ) => Promise<void>;
  createDebtVault: (
    pool: any,
    bobToken: any,
    borrower: { account: { address: `0x${string}` } },
    collateralAmount: bigint,
    borrowAsset: `0x${string}`,
    borrowAmount: bigint,
    publicClient: any
  ) => Promise<bigint>;
  logVaultState: (
    pool: any,
    debtVaultId: bigint,
    debtAsset: `0x${string}`,
    label: string
  ) => Promise<{ debt: bigint; hf: bigint }>;
}) {
  const {
    pool,
    oracle,
    aliceToken,
    bobToken,
    flashPool,
    flashBot,
    borrowerClient,
    ownerAddress,
    healthyBobPrice,
    directLiquidationBobPrice,
    one,
    publicClient,
    formatToken,
    assertCondition,
    setPrices,
    createDebtVault,
    logVaultState,
  } = params;

  await setPrices(oracle, aliceToken, bobToken, ownerAddress, publicClient, healthyBobPrice);
  const flashVaultId = await createDebtVault(
    pool,
    bobToken,
    borrowerClient,
    100n * one,
    aliceToken.address,
    100n * one,
    publicClient
  );
  await setPrices(oracle, aliceToken, bobToken, ownerAddress, publicClient, directLiquidationBobPrice);
  const flashBefore = await logVaultState(pool, flashVaultId, aliceToken.address, "Before flash liquidation");
  assertCondition(flashBefore.hf < one, "Flash liquidation vault is not liquidatable");

  const singleFlash = await executeFlashLiquidation(
    flashBot,
    flashPool,
    flashBot.address,
    aliceToken,
    bobToken,
    flashVaultId,
    ownerAddress,
    publicClient,
    100n * one,
    true,
    assertCondition
  );
  const flashAfter = await logVaultState(pool, flashVaultId, aliceToken.address, "After flash liquidation");
  const botBobClaimableShares = await pool.read.getUserClaimableShares([flashBot.address, bobToken.address]);
  console.log(
    "Flash pool fee earned:",
    formatToken(BigInt(singleFlash.flashPoolBalanceAfter - singleFlash.flashPoolBalanceBefore)),
    "ALC"
  );
  console.log("Bot ALC after single flash:", formatToken(singleFlash.botAliceAfter));
  console.log("Bot remaining claimable BOB shares:", botBobClaimableShares.toString());
  assertCondition(flashAfter.debt < flashBefore.debt, "Flash liquidation did not reduce debt");
}
