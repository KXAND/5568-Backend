import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  addCollateralToPosition,
  createAliceBobFixture,
  directLiquidate,
  exitPosition,
  flashLiquidate,
  openVault,
  parseAmount,
  readVaultState,
  releaseLocalNode,
  runQuietly,
  setPrices,
} from "../test-helpers.js";

describe("Collateral Top-Up Recovery", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("restores a too-heavily-borrowed vault to healthy by adding collateral after liquidation worsens HF", async () => {
    const cases = [
      {
        borrower: "B",
        label: "direct liquidation",
        async liquidate(ctx: Awaited<ReturnType<typeof createAliceBobFixture>>, vaultId: bigint) {
          await directLiquidate(ctx, {
            vaultId,
            liquidator: "A",
            borrowAsset: "bob",
            collateralAsset: "alice",
            repayAmount: "100",
          });
        },
      },
      {
        borrower: "C",
        label: "flash liquidation",
        async liquidate(ctx: Awaited<ReturnType<typeof createAliceBobFixture>>, vaultId: bigint) {
          await flashLiquidate(ctx, {
            vaultId,
            caller: "A",
            borrowAsset: "bob",
            collateralAsset: "alice",
            borrowAmount: "100",
          });
        },
      },
    ] as const;

    await runQuietly(async () => {
      for (const testCase of cases) {
        const ctx = await createAliceBobFixture();

        await setPrices(ctx, { alicePrice: "100", bobPrice: "1" });
        const position = await openVault(ctx, {
          borrower: testCase.borrower,
          collateralAsset: "alice",
          collateralAmount: "2",
          borrowAsset: "bob",
          borrowAmount: "100",
        });

        await setPrices(ctx, { alicePrice: "50", bobPrice: "1" });
        const beforeLiquidation = await readVaultState(ctx, position.vaultId, "bob");
        assert.ok(beforeLiquidation.hf < parseAmount("1"), `${testCase.label}: vault should be unhealthy before liquidation`);

        await testCase.liquidate(ctx, position.vaultId);
        const afterLiquidation = await readVaultState(ctx, position.vaultId, "bob");
        assert.ok(
          afterLiquidation.hf < beforeLiquidation.hf,
          `${testCase.label}: liquidation should worsen the health factor for this over-borrowed case`
        );

        await addCollateralToPosition(ctx, position, "1");
        const afterTopUp = await readVaultState(ctx, position.vaultId, "bob");
        assert.ok(afterTopUp.hf > afterLiquidation.hf, `${testCase.label}: extra collateral did not improve health factor`);
        assert.ok(afterTopUp.hf >= parseAmount("1"), `${testCase.label}: extra collateral did not restore a healthy HF`);

        await exitPosition(ctx, position);
      }
    });
  });
});