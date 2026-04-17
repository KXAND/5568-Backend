import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createIncentivesFixture,
  openVault,
  releaseLocalNode,
  runIncentivesRewardFlow,
  runQuietly,
} from "./test_qjh/test-helpers.js";

const ONE = 10n ** 18n;
const INCENTIVES_FUND = 100_000n * ONE;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

async function waitForReceipt(publicClient: any, hash: `0x${string}`) {
  await publicClient.waitForTransactionReceipt({ hash });
}

async function increaseTime(publicClient: any, seconds: number) {
  await publicClient.request({ method: "evm_increaseTime", params: [seconds] });
  await publicClient.request({ method: "evm_mine", params: [] });
}

describe("Pool Bonus Token Issuance", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("issues claimed POOL exactly equal to accrued rewards", async () => {
    await runQuietly(async () => {
      const ctx = await createIncentivesFixture();
      const poolCoin = await ctx.viem.getContractAt("PoolCoin", ctx.deployed.poolCoin);
      const incentives = await ctx.viem.getContractAt(
        "PoolIncentivesController",
        ctx.deployed.poolIncentivesController
      );

      const controllerPoolBefore = await poolCoin.read.balanceOf([incentives.address]);

      const result = await runIncentivesRewardFlow(ctx, {
        borrower: "B",
        collateralAmount: "100",
        borrowAmount: "10",
        healthyBobPrice: "2",
        withdrawAmount: "1",
        withdrawWaitSeconds: 60,
        repayAmount: "1",
        repayWaitSeconds: 60,
      });

      const ownerClaimed = result.ownerPoolAfter - result.ownerPoolBefore;
      const borrowerClaimed = result.borrowerPoolAfter - result.borrowerPoolBefore;
      const totalClaimed = ownerClaimed + borrowerClaimed;
      const controllerPoolAfter = await poolCoin.read.balanceOf([incentives.address]);
      const ownerUnclaimedAfter = await incentives.read.unclaimedRewards([ctx.addresses.A]);
      const borrowerUnclaimedAfter = await incentives.read.unclaimedRewards([ctx.addresses.B]);

      assert.equal(result.depositBefore, 0n, "owner should start with zero unclaimed rewards");
      assert.equal(result.repayBefore, 0n, "borrower should start with zero unclaimed rewards");
      assert.ok(result.depositAfter > 0n, "owner did not accrue POOL rewards");
      assert.ok(result.repayAfter > 0n, "borrower did not accrue POOL rewards");
      assert.equal(ownerClaimed, result.depositAfter, "owner claimed amount does not match accrued rewards");
      assert.equal(
        borrowerClaimed,
        result.repayAfter,
        "borrower claimed amount does not match accrued rewards"
      );
      assert.equal(ownerUnclaimedAfter, 0n, "owner unclaimed rewards should be cleared after claim");
      assert.equal(borrowerUnclaimedAfter, 0n, "borrower unclaimed rewards should be cleared after claim");
      assert.equal(
        controllerPoolBefore + INCENTIVES_FUND - controllerPoolAfter,
        totalClaimed,
        "controller POOL balance delta does not match total claimed rewards after funding"
      );
    });
  });

  it("accrues deposit-side POOL on the first withdraw after time has passed", async () => {
    await runQuietly(async () => {
      const ctx = await createIncentivesFixture();
      const poolCoin = await ctx.viem.getContractAt("PoolCoin", ctx.deployed.poolCoin);
      const incentives = await ctx.viem.getContractAt(
        "PoolIncentivesController",
        ctx.deployed.poolIncentivesController
      );

      const depositRewardType = await incentives.read.DEPOSIT_REWARD_TYPE();

      await waitForReceipt(
        ctx.publicClient,
        await incentives.write.configureReward([ctx.aliceToken.address, depositRewardType, 10n ** 16n], {
          account: ctx.addresses.A,
        })
      );
      await waitForReceipt(
        ctx.publicClient,
        await poolCoin.write.transfer([incentives.address, INCENTIVES_FUND], {
          account: ctx.addresses.A,
        })
      );

      const depositBefore = await incentives.read.unclaimedRewards([ctx.addresses.A]);
      await increaseTime(ctx.publicClient, 60);
      await waitForReceipt(
        ctx.publicClient,
        await ctx.pool.write.withdraw([ctx.aliceToken.address, ONE], { account: ctx.addresses.A })
      );
      const depositAfterFirstWithdraw = await incentives.read.unclaimedRewards([ctx.addresses.A]);

      assert.ok(
        depositAfterFirstWithdraw > depositBefore,
        "first withdraw should already accrue rewards from the existing deposit position"
      );
    });
  });

  it("accrues borrow-side POOL on the first repay after time has passed", async () => {
    await runQuietly(async () => {
      const ctx = await createIncentivesFixture();
      const poolCoin = await ctx.viem.getContractAt("PoolCoin", ctx.deployed.poolCoin);
      const incentives = await ctx.viem.getContractAt(
        "PoolIncentivesController",
        ctx.deployed.poolIncentivesController
      );

      const borrowRewardType = await incentives.read.BORROW_REWARD_TYPE();

      await waitForReceipt(
        ctx.publicClient,
        await incentives.write.configureReward([ctx.aliceToken.address, borrowRewardType, 2n * 10n ** 16n], {
          account: ctx.addresses.A,
        })
      );
      await waitForReceipt(
        ctx.publicClient,
        await poolCoin.write.transfer([incentives.address, INCENTIVES_FUND], {
          account: ctx.addresses.A,
        })
      );

      const position = await openVault(ctx, {
        borrower: "B",
        collateralAsset: "bob",
        collateralAmount: "100",
        borrowAsset: "alice",
        borrowAmount: "10",
      });

      await waitForReceipt(
        ctx.publicClient,
        await ctx.aliceToken.write.approve([ctx.pool.address, ONE], {
          account: ctx.addresses.B,
        })
      );

      const repayBefore = await incentives.read.unclaimedRewards([ctx.addresses.B]);
      await increaseTime(ctx.publicClient, 60);
      await waitForReceipt(
        ctx.publicClient,
        await ctx.pool.write.repay([position.vaultId, ctx.aliceToken.address, ONE], {
          account: ctx.addresses.B,
        })
      );
      const repayAfterFirstRepay = await incentives.read.unclaimedRewards([ctx.addresses.B]);

      assert.ok(
        repayAfterFirstRepay > repayBefore,
        "first repay should already accrue rewards from the existing borrow position"
      );
    });
  });

  it("reverts when claiming rewards to the zero address", async () => {
    await runQuietly(async () => {
      const ctx = await createIncentivesFixture();
      const incentives = await ctx.viem.getContractAt(
        "PoolIncentivesController",
        ctx.deployed.poolIncentivesController
      );

      await assert.rejects(
        incentives.write.claimRewards([ZERO_ADDRESS], { account: ctx.addresses.A }),
        "claimRewards should reject the zero address"
      );
    });
  });

  it("reverts when claiming with zero unclaimed rewards", async () => {
    await runQuietly(async () => {
      const ctx = await createIncentivesFixture();
      const incentives = await ctx.viem.getContractAt(
        "PoolIncentivesController",
        ctx.deployed.poolIncentivesController
      );

      await assert.rejects(
        incentives.write.claimRewards([ctx.addresses.A], { account: ctx.addresses.A }),
        "claimRewards should reject when no rewards are accrued"
      );
    });
  });

  it("reverts when a non-owner configures rewards", async () => {
    await runQuietly(async () => {
      const ctx = await createIncentivesFixture();
      const incentives = await ctx.viem.getContractAt(
        "PoolIncentivesController",
        ctx.deployed.poolIncentivesController
      );
      const depositRewardType = await incentives.read.DEPOSIT_REWARD_TYPE();

      await assert.rejects(
        incentives.write.configureReward([ctx.aliceToken.address, depositRewardType, 10n ** 16n], {
          account: ctx.addresses.B,
        }),
        "configureReward should be owner-only"
      );
    });
  });

  it("reverts when a non-owner updates the action handler", async () => {
    await runQuietly(async () => {
      const ctx = await createIncentivesFixture();
      const incentives = await ctx.viem.getContractAt(
        "PoolIncentivesController",
        ctx.deployed.poolIncentivesController
      );

      await assert.rejects(
        incentives.write.setActionHandler([ctx.addresses.B], { account: ctx.addresses.B }),
        "setActionHandler should be owner-only"
      );
    });
  });

  it("reverts when a non-action-handler calls handleAction directly", async () => {
    await runQuietly(async () => {
      const ctx = await createIncentivesFixture();
      const incentives = await ctx.viem.getContractAt(
        "PoolIncentivesController",
        ctx.deployed.poolIncentivesController
      );
      const depositRewardType = await incentives.read.DEPOSIT_REWARD_TYPE();

      await assert.rejects(
        incentives.write.handleAction([ctx.addresses.A, ctx.aliceToken.address, depositRewardType, ONE, ONE], {
          account: ctx.addresses.B,
        }),
        "handleAction should only be callable by the configured action handler"
      );
    });
  });

  it("does not accrue rewards when emissionPerSecond is zero", async () => {
    await runQuietly(async () => {
      const ctx = await createIncentivesFixture();
      const incentives = await ctx.viem.getContractAt(
        "PoolIncentivesController",
        ctx.deployed.poolIncentivesController
      );
      const depositRewardType = await incentives.read.DEPOSIT_REWARD_TYPE();

      await waitForReceipt(
        ctx.publicClient,
        await incentives.write.configureReward([ctx.aliceToken.address, depositRewardType, 0n], {
          account: ctx.addresses.A,
        })
      );

      const depositBefore = await incentives.read.unclaimedRewards([ctx.addresses.A]);
      await increaseTime(ctx.publicClient, 60);
      await waitForReceipt(
        ctx.publicClient,
        await ctx.pool.write.withdraw([ctx.aliceToken.address, ONE], { account: ctx.addresses.A })
      );
      const depositAfter = await incentives.read.unclaimedRewards([ctx.addresses.A]);

      assert.equal(depositAfter, depositBefore, "zero-emission market should not accrue rewards");
    });
  });

  it("reverts on claim when controller POOL balance is insufficient", async () => {
    await runQuietly(async () => {
      const ctx = await createIncentivesFixture();
      const poolCoin = await ctx.viem.getContractAt("PoolCoin", ctx.deployed.poolCoin);
      const incentives = await ctx.viem.getContractAt(
        "PoolIncentivesController",
        ctx.deployed.poolIncentivesController
      );
      const depositRewardType = await incentives.read.DEPOSIT_REWARD_TYPE();

      await waitForReceipt(
        ctx.publicClient,
        await incentives.write.configureReward([ctx.aliceToken.address, depositRewardType, 10n ** 16n], {
          account: ctx.addresses.A,
        })
      );
      await waitForReceipt(
        ctx.publicClient,
        await poolCoin.write.transfer([incentives.address, 1n], {
          account: ctx.addresses.A,
        })
      );

      await increaseTime(ctx.publicClient, 60);
      await waitForReceipt(
        ctx.publicClient,
        await ctx.pool.write.withdraw([ctx.aliceToken.address, ONE], { account: ctx.addresses.A })
      );

      const accrued = await incentives.read.unclaimedRewards([ctx.addresses.A]);
      assert.ok(accrued > 1n, "test setup did not accrue more rewards than controller balance");

      await assert.rejects(
        incentives.write.claimRewards([ctx.addresses.A], { account: ctx.addresses.A }),
        "claimRewards should fail when controller balance is insufficient"
      );
    });
  });
});
