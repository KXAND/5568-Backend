import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  exitPosition,
  openVault,
  parseAmount,
  recoverViaRepeatedFlashLiquidation,
  releaseLocalNode,
  runQuietly,
  setPrices,
} from "../test-helpers.js";

before(async () => {
  await acquireLocalNode();
});

after(async () => {
  await releaseLocalNode();
});

it("recovers an unhealthy Alice-collateral/Bob-borrow vault with repeated flash liquidations", async () => {
  const cases = [
    { borrowAmount: "86", label: "near liquidation threshold" },
    { borrowAmount: "90", label: "baseline unhealthy vault" },
    // { borrowAmount: "100", label: "deeper unhealthy vault" },
  ] as const;

  await runQuietly(async () => {
    for (const testCase of cases) {
      const ctx = await createAliceBobFixture();

      await setPrices(ctx, { alicePrice: "100", bobPrice: "1" });
      const position = await openVault(ctx, {
        borrower: "D",
        collateralAsset: "alice",
        collateralAmount: "2",
        borrowAsset: "bob",
        borrowAmount: testCase.borrowAmount,
      });

      await setPrices(ctx, { alicePrice: "50", bobPrice: "1" });
      const result = await recoverViaRepeatedFlashLiquidation(ctx, {
        vaultId: position.vaultId,
        caller: "A",
        borrowAsset: "bob",
        collateralAsset: "alice",
        maxIterations: 10,
        finalHealthFactorTarget: "1",
      });

      assert.ok(result.iteration > 0, `${testCase.label}: flash liquidation did not run`);
      assert.ok(
        result.state.hf >= parseAmount("1"),
        `${testCase.label}: vault did not return to a healthy state`
      );

      await exitPosition(ctx, position);
    }
  });
});