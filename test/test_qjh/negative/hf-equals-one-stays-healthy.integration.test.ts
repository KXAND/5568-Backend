import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  openVault,
  parseAmount,
  readVaultState,
  repeatFlashLiquidationCallsUntilHealthy,
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

it("treats HF = 1 as the healthy-side boundary for repeated flash liquidation attempts", async () => {
  await assert.rejects(
    runQuietly(async () => {
      const ctx = await createAliceBobFixture();

      await setPrices(ctx, { alicePrice: "100", bobPrice: "1" });
      const position = await openVault(ctx, {
        borrower: "D",
        collateralAsset: "alice",
        collateralAmount: "2",
        borrowAsset: "bob",
        borrowAmount: "85",
      });

      await setPrices(ctx, { alicePrice: "50", bobPrice: "1" });
      const state = await readVaultState(ctx, position.vaultId, "bob");
      assert.equal(state.hf, parseAmount("1"), "health factor should be exactly 1");

      await repeatFlashLiquidationCallsUntilHealthy(ctx, {
        vaultId: position.vaultId,
        caller: "A",
        borrowAsset: "bob",
        collateralAsset: "alice",
        maxIterations: 10,
        finalHealthFactorTarget: "1",
      });
    }),
    /vault is already healthy/i
  );
});