import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  flashLiquidate,
  openVault,
  parseAmount,
  readVaultState,
  releaseLocalNode,
  repeatFlashLiquidationCallsUntilHealthy,
  runQuietly,
  setPrices,
} from "../test-helpers.js";

describe("Negative - Flash Liquidation", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  describe("Boundary Checks", () => {
    it("rejects invalid flash-liquidation boundary cases", async () => {
      const cases = [
        {
          priceAfterAlice: "60",
          expectedError: /vault is not liquidatable/i,
          async run(ctx: Awaited<ReturnType<typeof createAliceBobFixture>>, position: { vaultId: bigint }) {
            const state = await readVaultState(ctx, position.vaultId, "bob");
            assert.ok(state.hf < parseAmount("1"), "vault is not liquidatable");
          },
        },
        {
          priceAfterAlice: "50",
          expectedError: /health factor did not increase after liquidation/i,
          async run(ctx: Awaited<ReturnType<typeof createAliceBobFixture>>, position: { vaultId: bigint }) {
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
            const ctx = await createAliceBobFixture();
            await setPrices(ctx, { alicePrice: "100", bobPrice: "1" });
            const position = await openVault(ctx, {
              borrower: "C",
              collateralAsset: "alice",
              collateralAmount: "2",
              borrowAsset: "bob",
              borrowAmount: "100",
            });

            await setPrices(ctx, { alicePrice: testCase.priceAfterAlice, bobPrice: "1" });
            await testCase.run(ctx, position);
          }),
          testCase.expectedError
        );
      }
    });

    it("rejects invalid repeated single-flash-call boundary cases", async () => {
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
            await repeatFlashLiquidationCallsUntilHealthy(ctx, {
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
  });
});
