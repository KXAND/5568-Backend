import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

import { deploy } from "../scripts/scenarios/deploy.js";
import { runIncentivesDemo } from "../scripts/scenarios/incentives.js";

const ONE = 10n ** 18n;
const BOB_PRICE_HEALTHY = 2n * ONE;
const BOB_PRICE_DIRECT_LIQUIDATION = 1n * ONE;
const BOB_PRICE_MULTI_LIQUIDATION = 985_000_000_000_000_000n;

function assertCondition(condition: boolean, message: string) {
  assert.equal(condition, true, message);
}

async function waitForReceipt(publicClient: any, hash: `0x${string}`) {
  await publicClient.waitForTransactionReceipt({ hash });
}

async function setPrices(
  oracle: any,
  aliceToken: any,
  bobToken: any,
  account: `0x${string}`,
  publicClient: any,
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
  publicClient: any
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
    await pool.write.depositCollateral([debtVaultId, bobToken.address, collateralAmount], {
      account: borrowerAddress,
    })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.borrow([debtVaultId, borrowAsset, borrowAmount], { account: borrowerAddress })
  );

  return debtVaultId;
}

async function executeFlashLiquidation(
  flashBot: any,
  flashPool: any,
  flashBotAddress: `0x${string}`,
  aliceToken: any,
  collateralAsset: `0x${string}`,
  debtVaultId: bigint,
  caller: `0x${string}`,
  publicClient: any,
  borrowAmount: bigint,
) {
  const feeRate = await flashPool.read.feeRate();
  const expectedFee = (borrowAmount * feeRate) / 10_000n;
  const flashPoolBalanceBefore = await flashPool.read.getBalance([aliceToken.address]);
  const botAliceBefore = await aliceToken.read.balanceOf([flashBotAddress]);

  const flashTx = await flashBot.write.borrow(
    [aliceToken.address, borrowAmount, debtVaultId, collateralAsset],
    { account: caller }
  );
  await publicClient.waitForTransactionReceipt({ hash: flashTx });

  const flashPoolBalanceAfter = await flashPool.read.getBalance([aliceToken.address]);
  const botAliceAfter = await aliceToken.read.balanceOf([flashBotAddress]);

  assertCondition(
    flashPoolBalanceAfter >= flashPoolBalanceBefore + expectedFee,
    "Flash pool did not receive the expected repayment fee"
  );
  assertCondition(botAliceAfter >= botAliceBefore, "Bot ALC balance unexpectedly decreased");

  return {
    flashPoolBalanceBefore,
    flashPoolBalanceAfter,
  };
}

describe("Lending protocol dynamic testing", () => {
  it("covers liquidation, flash loans, and incentives end to end", async () => {
    const { viem } = await network.connect({ network: "hardhatMainnet" });
    const publicClient = await viem.getPublicClient();
    const [owner, borrowerB, borrowerC, borrowerD] = await viem.getWalletClients();
    const ownerAddress = owner.account.address;

    const deployed = await deploy({ viem, log: false });

    const oracle = await viem.getContractAt("SimpleOracle", deployed.oracle);
    const aliceFaucet = await viem.getContractAt("AliceFaucet", deployed.aliceFaucet);
    const bobFaucet = await viem.getContractAt("BobFaucet", deployed.bobFaucet);
    const aliceToken = await viem.getContractAt("AliceToken", deployed.aliceToken);
    const bobToken = await viem.getContractAt("BobToken", deployed.bobToken);
    const pool = await viem.getContractAt("LendingPool", deployed.pool);
    const flashPool = await viem.getContractAt("FlashLoanPool", deployed.flashPool);
    const flashSwap = await viem.getContractAt("FlashLoanSwap", deployed.flashSwap);
    const flashBot = await viem.getContractAt("FlashLoanBot", deployed.flashBot);

    await setPrices(oracle, aliceToken, bobToken, ownerAddress, publicClient, BOB_PRICE_HEALTHY);

    await waitForReceipt(publicClient, await aliceFaucet.write.claim({ account: ownerAddress }));
    await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: ownerAddress }));
    await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: borrowerB.account.address }));
    await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: borrowerC.account.address }));
    await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: borrowerD.account.address }));

    const reserveLiquidity = 5_000n * ONE;
    await waitForReceipt(
      publicClient,
      await aliceToken.write.approve([pool.address, reserveLiquidity], { account: ownerAddress })
    );
    await waitForReceipt(
      publicClient,
      await pool.write.deposit([aliceToken.address, reserveLiquidity], { account: ownerAddress })
    );

    const flashLiquidity = 1_000n * ONE;
    await waitForReceipt(
      publicClient,
      await aliceToken.write.approve([flashPool.address, flashLiquidity], { account: ownerAddress })
    );
    await waitForReceipt(
      publicClient,
      await flashPool.write.deposit([aliceToken.address, flashLiquidity], { account: ownerAddress })
    );

    const swapLiquidity = 1_000n * ONE;
    await waitForReceipt(
      publicClient,
      await aliceToken.write.approve([flashSwap.address, swapLiquidity], { account: ownerAddress })
    );
    await waitForReceipt(
      publicClient,
      await bobToken.write.approve([flashSwap.address, swapLiquidity], { account: ownerAddress })
    );
    await waitForReceipt(
      publicClient,
      await flashSwap.write.addLiquidity([aliceToken.address, swapLiquidity], { account: ownerAddress })
    );
    await waitForReceipt(
      publicClient,
      await flashSwap.write.addLiquidity([bobToken.address, swapLiquidity], { account: ownerAddress })
    );

    const directVaultId = await createDebtVault(
      pool,
      bobToken,
      borrowerB,
      100n * ONE,
      aliceToken.address,
      100n * ONE,
      publicClient
    );

    await setPrices(
      oracle,
      aliceToken,
      bobToken,
      ownerAddress,
      publicClient,
      BOB_PRICE_DIRECT_LIQUIDATION
    );
    const directDebtBefore = await pool.read.getDebtVaultDebtAmount([directVaultId, aliceToken.address]);
    const directHfBefore = await pool.read.healthFactor([directVaultId]);
    assertCondition(directHfBefore < ONE, "Direct liquidation vault should be liquidatable");

    const directClaimableBefore = await pool.read.getUserClaimableShares([ownerAddress, bobToken.address]);
    await waitForReceipt(
      publicClient,
      await aliceToken.write.approve([pool.address, 100n * ONE], { account: ownerAddress })
    );
    await waitForReceipt(
      publicClient,
      await pool.write.liquidate([directVaultId, aliceToken.address, bobToken.address, 100n * ONE], {
        account: ownerAddress,
      })
    );

    const directDebtAfter = await pool.read.getDebtVaultDebtAmount([directVaultId, aliceToken.address]);
    const directClaimableAfter = await pool.read.getUserClaimableShares([ownerAddress, bobToken.address]);
    assertCondition(directDebtAfter < directDebtBefore, "Direct liquidation did not reduce debt");
    assertCondition(
      directClaimableAfter > directClaimableBefore,
      "Direct liquidator did not receive collateral shares"
    );

    await setPrices(oracle, aliceToken, bobToken, ownerAddress, publicClient, BOB_PRICE_HEALTHY);
    const flashVaultId = await createDebtVault(
      pool,
      bobToken,
      borrowerC,
      100n * ONE,
      aliceToken.address,
      100n * ONE,
      publicClient
    );
    await setPrices(
      oracle,
      aliceToken,
      bobToken,
      ownerAddress,
      publicClient,
      BOB_PRICE_DIRECT_LIQUIDATION
    );

    const flashDebtBefore = await pool.read.getDebtVaultDebtAmount([flashVaultId, aliceToken.address]);
    const flashHfBefore = await pool.read.healthFactor([flashVaultId]);
    assertCondition(flashHfBefore < ONE, "Flash liquidation vault should be liquidatable");

    const singleFlash = await executeFlashLiquidation(
      flashBot,
      flashPool,
      flashBot.address,
      aliceToken,
      bobToken.address,
      flashVaultId,
      ownerAddress,
      publicClient,
      100n * ONE,
    );

    const flashDebtAfter = await pool.read.getDebtVaultDebtAmount([flashVaultId, aliceToken.address]);
    assertCondition(flashDebtAfter < flashDebtBefore, "Single flash liquidation did not reduce debt");
    assertCondition(
      singleFlash.flashPoolBalanceAfter > singleFlash.flashPoolBalanceBefore,
      "Flash pool did not earn a fee"
    );

    await setPrices(oracle, aliceToken, bobToken, ownerAddress, publicClient, BOB_PRICE_HEALTHY);
    const multiVaultId = await createDebtVault(
      pool,
      bobToken,
      borrowerD,
      100n * ONE,
      aliceToken.address,
      90n * ONE,
      publicClient
    );
    await setPrices(
      oracle,
      aliceToken,
      bobToken,
      ownerAddress,
      publicClient,
      BOB_PRICE_MULTI_LIQUIDATION
    );

    let iteration = 0;
    let multiHf = await pool.read.healthFactor([multiVaultId]);
    assertCondition(multiHf < ONE, "Multi-liquidation vault should start unhealthy");

    while (multiHf < ONE) {
      iteration += 1;
      const currentDebt = await pool.read.getDebtVaultDebtAmount([multiVaultId, aliceToken.address]);
      await executeFlashLiquidation(
        flashBot,
        flashPool,
        flashBot.address,
        aliceToken,
        bobToken.address,
        multiVaultId,
        ownerAddress,
        publicClient,
        currentDebt,
      );
      multiHf = await pool.read.healthFactor([multiVaultId]);
      assertCondition(iteration < 10, "Too many flash liquidations without restoring health");
    }

    assertCondition(multiHf >= ONE, "Repeated flash liquidation should restore a healthy vault");

    const incentivesResult = await runIncentivesDemo({
      viem,
      publicClient,
      deployed,
      pool,
      oracle,
      aliceToken,
      bobToken,
      borrowerClient: borrowerB,
      ownerAddress,
      one: ONE,
      healthyBobPrice: BOB_PRICE_HEALTHY,
      waitForReceipt,
      setPrices,
      createDebtVault,
    });

    assertCondition(
      incentivesResult.depositAfter > incentivesResult.depositBefore,
      "Withdraw incentives did not accrue rewards"
    );
    assertCondition(
      incentivesResult.repayAfter > incentivesResult.repayBefore,
      "Repay incentives did not accrue rewards"
    );
    assertCondition(
      incentivesResult.ownerPoolAfter > incentivesResult.ownerPoolBefore,
      "Owner could not claim accrued rewards"
    );
    assertCondition(
      incentivesResult.borrowerPoolAfter > incentivesResult.borrowerPoolBefore,
      "Borrower could not claim accrued rewards"
    );
  });
});