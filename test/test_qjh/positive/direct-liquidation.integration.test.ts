import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  directLiquidate,
  exitPosition,
  openVault,
  parseAmount,
  readVaultState,
  releaseLocalNode,
  runQuietly,
  setPrices,
} from "../test-helpers.js";

describe("Positive - Direct Liquidation", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  describe("HF Improvement", () => {
    it("raises HF after direct liquidation for the Alice-collateral/Bob-borrow vault", async () => {
      const cases = [
        {
          borrowAmount: "95",
          priceAfterAlice: "55",
          repayAmount: "95",
          label: "deeper unhealthy vault",
        },
        {
          borrowAmount: "100",
          priceAfterAlice: "58",
          repayAmount: "100",
          label: "near-threshold unhealthy vault",
        },
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

          await setPrices(ctx, { alicePrice: testCase.priceAfterAlice, bobPrice: "1" });
          const before = await readVaultState(ctx, position.vaultId, "bob");
          assert.ok(before.hf < parseAmount("1"), `${testCase.label}: health factor did not drop below threshold`);

          const liquidation = await directLiquidate(ctx, {
            vaultId: position.vaultId,
            liquidator: "A",
            borrowAsset: "bob",
            collateralAsset: "alice",
            repayAmount: testCase.repayAmount,
          });
          const after = await readVaultState(ctx, position.vaultId, "bob");

          assert.ok(after.debt < before.debt, `${testCase.label}: debt was not reduced`);
          assert.ok(after.hf > before.hf, `${testCase.label}: health factor did not increase after liquidation`);
          assert.ok(liquidation.seizedShares > 0n, `${testCase.label}: no collateral shares were seized`);

          await exitPosition(ctx, position);
        }
      });
    });
  });
});
