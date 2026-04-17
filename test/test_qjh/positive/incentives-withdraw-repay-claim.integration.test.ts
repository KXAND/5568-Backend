import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createIncentivesFixture,
  releaseLocalNode,
  runIncentivesRewardFlow,
  runQuietly,
} from "../test-helpers.js";

describe("Incentives Reward Flow", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("accrues and claims rewards after withdraw and repay actions", async () => {
    const cases = [
      {
        collateralAmount: "100",
        borrowAmount: "10",
        withdrawAmount: "1",
        withdrawWaitSeconds: 60,
        repayAmount: "1",
        repayWaitSeconds: 60,
        label: "baseline reward accrual",
      },
      {
        collateralAmount: "120",
        borrowAmount: "12",
        withdrawAmount: "2",
        withdrawWaitSeconds: 90,
        repayAmount: "2",
        repayWaitSeconds: 90,
        label: "larger withdraw and repay flow",
      },
    ] as const;

    await runQuietly(async () => {
      for (const testCase of cases) {
        const ctx = await createIncentivesFixture();
        const result = await runIncentivesRewardFlow(ctx, {
          borrower: "B",
          collateralAmount: testCase.collateralAmount,
          borrowAmount: testCase.borrowAmount,
          healthyBobPrice: "2",
          withdrawAmount: testCase.withdrawAmount,
          withdrawWaitSeconds: testCase.withdrawWaitSeconds,
          repayAmount: testCase.repayAmount,
          repayWaitSeconds: testCase.repayWaitSeconds,
        });

        assert.ok(result.depositAfter > result.depositBefore, `${testCase.label}: owner rewards did not increase`);
        assert.ok(result.repayAfter > result.repayBefore, `${testCase.label}: borrower rewards did not increase`);
        assert.ok(
          result.ownerPoolAfter > result.ownerPoolBefore,
          `${testCase.label}: owner reward claim did not increase balance`
        );
        assert.ok(
          result.borrowerPoolAfter > result.borrowerPoolBefore,
          `${testCase.label}: borrower reward claim did not increase balance`
        );
      }
    });
  });

  it("settles PoolCoin rewards exactly and clears unclaimed rewards after claim", async () => {
    await runQuietly(async () => {
      const ctx = await createIncentivesFixture();
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

      console.error(
        `[ACTUAL] owner pre-claim unclaimed=${result.ownerUnclaimedBeforeClaim.toString()}, owner claimed=${ownerClaimed.toString()}, owner post-claim unclaimed=${result.ownerUnclaimedAfterClaim.toString()}`
      );
      console.error(
        `[ACTUAL] borrower pre-claim unclaimed=${result.borrowerUnclaimedBeforeClaim.toString()}, borrower claimed=${borrowerClaimed.toString()}, borrower post-claim unclaimed=${result.borrowerUnclaimedAfterClaim.toString()}`
      );

      assert.equal(
        ownerClaimed,
        result.ownerUnclaimedBeforeClaim,
        "owner claimed POOL should equal pre-claim unclaimed deposit rewards"
      );
      assert.equal(
        borrowerClaimed,
        result.borrowerUnclaimedBeforeClaim,
        "borrower claimed POOL should equal pre-claim unclaimed borrow rewards"
      );
      assert.equal(result.ownerUnclaimedAfterClaim, 0n, "owner unclaimed rewards should be zero after claim");
      assert.equal(result.borrowerUnclaimedAfterClaim, 0n, "borrower unclaimed rewards should be zero after claim");
    });
  });
});