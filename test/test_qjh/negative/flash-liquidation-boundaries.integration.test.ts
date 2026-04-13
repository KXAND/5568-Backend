import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  flashLiquidate,
  openVault,
  parseAmount,
  readVaultState,
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

it("rejects invalid flash-liquidation boundary cases", async () => {
  const cases = [
    {
      priceAfterAlice: "60",
      expectedError: /vault is not liquidatable/i,
      async run(position: { vaultId: bigint }) {
        const state = await readVaultState(ctx, position.vaultId, "bob");
        assert.ok(state.hf < parseAmount("1"), "vault is not liquidatable");
      },
    },
    {
      priceAfterAlice: "50",
      expectedError: /health factor did not increase after liquidation/i,
      async run(position: { vaultId: bigint }) {
        const before = await readVaultState(ctx, position.vaultId, "bob");
        assert.ok(before.hf < parseAmount("1"), "vault is not liquidatable");

        await flashLiquidate(ctx, {
          vaultId: position.vaultId,
          caller: "A",
          borrowAsset: "bob",
          collateralAsset: "alice",
          borrowAmount: "100",
        });

        const after = await readVaultState(ctx, position.vaultId, "bob");
        assert.ok(after.hf > before.hf, "health factor did not increase after liquidation");
      },
    },
  ] as const;

  for (const testCase of cases) {
    await assert.rejects(
      runQuietly(async () => {
        await setPrices(ctx, { alicePrice: "100", bobPrice: "1" });
        const position = await openVault(ctx, {
          borrower: "C",
          collateralAsset: "alice",
          collateralAmount: "2",
          borrowAsset: "bob",
          borrowAmount: "100",
        });

        await setPrices(ctx, { alicePrice: testCase.priceAfterAlice, bobPrice: "1" });
        await testCase.run(position);
      }),
      testCase.expectedError
    );
  }
});