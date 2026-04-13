import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  openVault,
  recoverViaRepeatedFlashLiquidation,
  releaseLocalNode,
  runQuietly,
  setPrices,
  type TestContext,
} from "../test-helpers.js";

let ctx: TestContext;

before(async () => {
  await acquireLocalNode();
  ctx = await runQuietly(() => createAliceBobFixture());
});

after(async () => {
  await releaseLocalNode();
});

it("rejects invalid repeated-flash boundary cases", async () => {
  const cases = [
    {
      borrowAmount: "60",
      maxIterations: 10,
      expectedError: /vault is already healthy/i,
    },
    {
      borrowAmount: "90",
      maxIterations: 1,
      expectedError: /exceeded max iterations/i,
    },
  ] as const;

  for (const testCase of cases) {
    await assert.rejects(
      runQuietly(async () => {
        await setPrices(ctx, { alicePrice: "100", bobPrice: "1" });
        const position = await openVault(ctx, {
          borrower: "D",
          collateralAsset: "alice",
          collateralAmount: "2",
          borrowAsset: "bob",
          borrowAmount: testCase.borrowAmount,
        });

        await setPrices(ctx, { alicePrice: "50", bobPrice: "1" });
        await recoverViaRepeatedFlashLiquidation(ctx, {
          vaultId: position.vaultId,
          caller: "A",
          borrowAsset: "bob",
          collateralAsset: "alice",
          maxIterations: testCase.maxIterations,
          finalHealthFactorTarget: "1",
        });
      }),
      testCase.expectedError
    );
  }
});