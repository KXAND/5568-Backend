import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  directLiquidate,
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

it("rejects invalid direct-liquidation boundary cases", async () => {
  const cases = [
    {
      priceAfterAlice: "60",
      expectedError: /health factor did not drop below threshold/i,
      async run(position: { vaultId: bigint }) {
        const state = await readVaultState(ctx, position.vaultId, "bob");
        assert.ok(state.hf < parseAmount("1"), "health factor did not drop below threshold");
      },
    },
    {
      priceAfterAlice: "50",
      expectedError: /health factor did not increase after liquidation/i,
      async run(position: { vaultId: bigint }) {
        const before = await readVaultState(ctx, position.vaultId, "bob");
        assert.ok(before.hf < parseAmount("1"), "health factor did not drop below threshold");

        await directLiquidate(ctx, {
          vaultId: position.vaultId,
          liquidator: "A",
          borrowAsset: "bob",
          collateralAsset: "alice",
          repayAmount: "100",
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
          borrower: "B",
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