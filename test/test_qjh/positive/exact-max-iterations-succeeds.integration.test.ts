import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import {
  acquireLocalNode,
  createAliceBobFixture,
  exitPosition,
  openVault,
  parseAmount,
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