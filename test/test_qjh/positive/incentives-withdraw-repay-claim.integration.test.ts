import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import {
  acquireLocalNode,
  createIncentivesFixture,
  releaseLocalNode,
  runIncentivesRewardFlow,
  runQuietly,
} from "../test-helpers.js";

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