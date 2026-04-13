import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  exitPosition,
  flashLiquidate,
  openVault,
  parseAmount,
  readVaultState,
  releaseLocalNode,
  runQuietly,
  setPrices,
} from "../test-helpers.js";

describe("Flash Liquidation", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  it("raises HF after flash liquidation for the Alice-collateral/Bob-borrow vault", async () => {
    const cases = [
      {
        borrowAmount: "95",
        priceAfterAlice: "55",
        flashBorrowAmount: "95",
        label: "deeper unhealthy vault",
      },
      {
        borrowAmount: "100",
        priceAfterAlice: "58",
        flashBorrowAmount: "100",
        label: "near-threshold unhealthy vault",
      },
    ] as const;

    await runQuietly(async () => {
      for (const testCase of cases) {
        const ctx = await createAliceBobFixture();

        await setPrices(ctx, { alicePrice: "100", bobPrice: "1" });
        const position = await openVault(ctx, {
          borrower: "C",
          collateralAsset: "alice",
          collateralAmount: "2",
          borrowAsset: "bob",
          borrowAmount: testCase.borrowAmount,
        });

        await setPrices(ctx, { alicePrice: testCase.priceAfterAlice, bobPrice: "1" });
        const before = await readVaultState(ctx, position.vaultId, "bob");
        assert.ok(before.hf < parseAmount("1"), `${testCase.label}: vault is not liquidatable`);

        const flashResult = await flashLiquidate(ctx, {
          vaultId: position.vaultId,
          caller: "A",
          borrowAsset: "bob",
          collateralAsset: "alice",
          borrowAmount: testCase.flashBorrowAmount,
          verboseLogs: true,
        });
        const after = await readVaultState(ctx, position.vaultId, "bob");

        assert.ok(after.debt < before.debt, `${testCase.label}: debt was not reduced`);
        assert.ok(after.hf > before.hf, `${testCase.label}: health factor did not increase after liquidation`);
        assert.ok(flashResult.feeEarned > 0n, `${testCase.label}: flash pool did not earn fees`);

        await exitPosition(ctx, position);
      }
    });
  });
});