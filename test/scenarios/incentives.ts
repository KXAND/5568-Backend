import type { WalletClient } from "viem";

type RunIncentivesDemoParams = {
  viem: any;
  publicClient: any;
  deployed: {
    poolCoin: `0x${string}`;
    poolIncentivesController: `0x${string}`;
  };
  pool: any;
  oracle: any;
  aliceToken: any;
  bobToken: any;
  borrowerClient: WalletClient;
  ownerAddress: `0x${string}`;
  one: bigint;
  healthyBobPrice: bigint;
  waitForReceipt: (publicClient: any, hash: `0x${string}`) => Promise<void>;
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
  collateralAmount?: bigint;
  borrowAmount?: bigint;
  withdrawAmount?: bigint;
  withdrawWaitSeconds?: number;
  repayAmount?: bigint;
  repayWaitSeconds?: number;
};

async function increaseTime(publicClient: any, seconds: number) {
  await publicClient.request({ method: "evm_increaseTime", params: [seconds] });
  await publicClient.request({ method: "evm_mine", params: [] });
}

export async function runIncentivesDemo(params: RunIncentivesDemoParams) {
  const {
    viem,
    publicClient,
    deployed,
    pool,
    oracle,
    aliceToken,
    bobToken,
    borrowerClient,
    ownerAddress,
    one,
    healthyBobPrice,
    waitForReceipt,
    setPrices,
    createDebtVault,
    collateralAmount = 100n * one,
    borrowAmount = 10n * one,
    withdrawAmount = 1n * one,
    withdrawWaitSeconds = 60,
    repayAmount = 1n * one,
    repayWaitSeconds = 60,
  } = params;

  const poolCoin = await viem.getContractAt("PoolCoin", deployed.poolCoin);
  const incentives = await viem.getContractAt(
    "PoolIncentivesController",
    deployed.poolIncentivesController
  );

  const depositRewardType = await incentives.read.DEPOSIT_REWARD_TYPE();
  const borrowRewardType = await incentives.read.BORROW_REWARD_TYPE();

  const depositEmissionPerSecond = 10n ** 16n;
  const borrowEmissionPerSecond = 2n * 10n ** 16n;
  await waitForReceipt(
    publicClient,
    await incentives.write.configureReward(
      [aliceToken.address, depositRewardType, depositEmissionPerSecond],
      { account: ownerAddress }
    )
  );
  await waitForReceipt(
    publicClient,
    await incentives.write.configureReward(
      [aliceToken.address, borrowRewardType, borrowEmissionPerSecond],
      { account: ownerAddress }
    )
  );

  const incentivesFund = 100_000n * one;
  await waitForReceipt(
    publicClient,
    await poolCoin.write.transfer([incentives.address, incentivesFund], {
      account: ownerAddress,
    })
  );

  const withdrawUser = ownerAddress;
  const depositBefore = await incentives.read.unclaimedRewards([withdrawUser]);

  await increaseTime(publicClient, withdrawWaitSeconds);
  await waitForReceipt(
    publicClient,
    await pool.write.withdraw([aliceToken.address, withdrawAmount], {
      account: withdrawUser,
    })
  );
  await increaseTime(publicClient, withdrawWaitSeconds);
  await waitForReceipt(
    publicClient,
    await pool.write.withdraw([aliceToken.address, withdrawAmount], {
      account: withdrawUser,
    })
  );
  const depositAfter = await incentives.read.unclaimedRewards([withdrawUser]);
  console.log(
    "Incentives withdraw demo: unclaimed before =",
    depositBefore.toString(),
    ", after =",
    depositAfter.toString()
  );

  const borrowerAddress = borrowerClient.account?.address;
  if (borrowerAddress === undefined) {
    throw new Error("Borrower wallet client has no default account");
  }

  await setPrices(
    oracle,
    aliceToken,
    bobToken,
    ownerAddress,
    publicClient,
    healthyBobPrice
  );
  const repayVaultId = await createDebtVault(
    pool,
    bobToken,
    { account: { address: borrowerAddress } },
    collateralAmount,
    aliceToken.address,
    borrowAmount,
    publicClient
  );

  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([pool.address, 2n * repayAmount], {
      account: borrowerAddress,
    })
  );

  const repayBefore = await incentives.read.unclaimedRewards([borrowerAddress]);
  await increaseTime(publicClient, repayWaitSeconds);
  await waitForReceipt(
    publicClient,
    await pool.write.repay([repayVaultId, aliceToken.address, repayAmount], {
      account: borrowerAddress,
    })
  );
  await increaseTime(publicClient, repayWaitSeconds);
  await waitForReceipt(
    publicClient,
    await pool.write.repay([repayVaultId, aliceToken.address, repayAmount], {
      account: borrowerAddress,
    })
  );
  const repayAfter = await incentives.read.unclaimedRewards([borrowerAddress]);
  console.log(
    "Incentives repay demo: unclaimed before =",
    repayBefore.toString(),
    ", after =",
    repayAfter.toString()
  );

  const ownerPoolBefore = await poolCoin.read.balanceOf([ownerAddress]);
  if (depositAfter > 0n) {
    await waitForReceipt(
      publicClient,
      await incentives.write.claimRewards([ownerAddress], {
        account: ownerAddress,
      })
    );
  }
  const ownerPoolAfter = await poolCoin.read.balanceOf([ownerAddress]);
  console.log(
    "Incentives claim demo (owner): POOL before =",
    ownerPoolBefore.toString(),
    ", after =",
    ownerPoolAfter.toString()
  );

  const borrowerPoolBefore = await poolCoin.read.balanceOf([borrowerAddress]);
  if (repayAfter > 0n) {
    await waitForReceipt(
      publicClient,
      await incentives.write.claimRewards([borrowerAddress], {
        account: borrowerAddress,
      })
    );
  }
  const borrowerPoolAfter = await poolCoin.read.balanceOf([borrowerAddress]);
  console.log(
    "Incentives claim demo (borrower): POOL before =",
    borrowerPoolBefore.toString(),
    ", after =",
    borrowerPoolAfter.toString()
  );

  return {
    depositBefore,
    depositAfter,
    repayBefore,
    repayAfter,
    ownerPoolBefore,
    ownerPoolAfter,
    borrowerPoolBefore,
    borrowerPoolAfter,
  };
}
