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
  repeatFlashLiquidationCallsUntilHealthy,
  runQuietly,
  setPrices,
} from "../test-helpers.js";

describe("Positive - Flash Liquidation", () => {
  before(async () => {
    await acquireLocalNode();
  });

  after(async () => {
    await releaseLocalNode();
  });

  describe("HF Improvement", () => {
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

    it("recovers an unhealthy vault by repeatedly calling single flash liquidations", async () => {
      const cases = [
        { borrowAmount: "86", label: "near liquidation threshold" },
        { borrowAmount: "90", label: "baseline unhealthy vault" },
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
          const result = await repeatFlashLiquidationCallsUntilHealthy(ctx, {
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
  });

  describe("Iteration Limits", () => {
    it("succeeds when maxIterations exactly matches the required repeated flash-liquidation calls", async () => {
      await runQuietly(async () => {
        const calibrationCtx = await createAliceBobFixture();
        await setPrices(calibrationCtx, { alicePrice: "100", bobPrice: "1" });
        const calibrationPosition = await openVault(calibrationCtx, {
          borrower: "D",
          collateralAsset: "alice",
          collateralAmount: "2",
          borrowAsset: "bob",
          borrowAmount: "90",
        });

        await setPrices(calibrationCtx, { alicePrice: "50", bobPrice: "1" });
        const calibrationResult = await repeatFlashLiquidationCallsUntilHealthy(calibrationCtx, {
          vaultId: calibrationPosition.vaultId,
          caller: "A",
          borrowAsset: "bob",
          collateralAsset: "alice",
          maxIterations: 10,
          finalHealthFactorTarget: "1",
        });

        const requiredIterations = calibrationResult.iteration;
        assert.ok(requiredIterations > 0, "calibration did not require any flash liquidation calls");

        const exactLimitCtx = await createAliceBobFixture();
        await setPrices(exactLimitCtx, { alicePrice: "100", bobPrice: "1" });
        const exactLimitPosition = await openVault(exactLimitCtx, {
          borrower: "D",
          collateralAsset: "alice",
          collateralAmount: "2",
          borrowAsset: "bob",
          borrowAmount: "90",
        });

        await setPrices(exactLimitCtx, { alicePrice: "50", bobPrice: "1" });
        const exactLimitResult = await repeatFlashLiquidationCallsUntilHealthy(exactLimitCtx, {
          vaultId: exactLimitPosition.vaultId,
          caller: "A",
          borrowAsset: "bob",
          collateralAsset: "alice",
          maxIterations: Number(requiredIterations),
          finalHealthFactorTarget: "1",
        });

        assert.equal(exactLimitResult.iteration, requiredIterations, "exact maxIterations did not finish on the calibrated step count");
        assert.ok(exactLimitResult.state.hf >= parseAmount("1"), "vault did not recover when maxIterations was exactly enough");

        await exitPosition(exactLimitCtx, exactLimitPosition);
      });
    });
  });
});
