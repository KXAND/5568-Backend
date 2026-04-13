import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  exitPosition,
  openVault,
  parseAmount,
  readVaultState,
  releaseLocalNode,
  runQuietly,
  setPrices,
} from "../test-helpers.js";

describe("Healthy Borrow", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("keeps the Alice-collateral/Bob-borrow vault healthy after borrow", async () => {
    const cases = [
      { borrowAmount: "40", minHealthFactor: "4.2", label: "light borrow" },
      { borrowAmount: "60", minHealthFactor: "2.8", label: "baseline borrow" },
      { borrowAmount: "70", minHealthFactor: "2.4", label: "heavier but still healthy borrow" },
    ] as const;

    await runQuietly(async () => {
      for (const testCase of cases) {
        const ctx = await createAliceBobFixture();

        await setPrices(ctx, { alicePrice: "100", bobPrice: "1" });

        const position = await openVault(ctx, {
          borrower: "B",
          collateralAsset: "alice",
          collateralAmount: "2",
          borrowAsset: "bob",
          borrowAmount: testCase.borrowAmount,
        });
        const state = await readVaultState(ctx, position.vaultId, "bob");

        assert.ok(state.debt > 0n, `${testCase.label}: vault debt was not created`);
        assert.ok(
          state.hf >= parseAmount(testCase.minHealthFactor),
          `${testCase.label}: health factor is below expected threshold`
        );

        await exitPosition(ctx, position);
      }
    });
  });
});