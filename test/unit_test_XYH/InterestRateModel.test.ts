import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network, viem } from "hardhat";

describe("InterestRateModel", async function () {
  const { viem: viemInstance } = await network.connect();

  let irModel: any;
  // 使用 BigInt 明确指定
  const E18 = 10n ** 18n;
  const BASE_RATE = 5n * (10n ** 16n);     // 5% = 0.05 * 10^18
  const SLOPE1 = 1n * (10n ** 17n);        // 10% = 0.1 * 10^18
  const SLOPE2 = 5n * (10n ** 17n);       // 50% = 0.5 * 10^18
  const KINK = 8n * (10n ** 17n);          // 80% = 0.8 * 10^18

  before(async () => {
    irModel = await viemInstance.deployContract("InterestRateModel", [
      BASE_RATE,
      SLOPE1,
      SLOPE2,
      KINK,
    ]);
  });

  it("should have correct immutable parameters", async function () {
    const baseRate = await irModel.read.baseRate();
    const slope1 = await irModel.read.slope1();
    const slope2 = await irModel.read.slope2();
    const kink = await irModel.read.kink();

    assert.equal(baseRate, BASE_RATE);
    assert.equal(slope1, SLOPE1);
    assert.equal(slope2, SLOPE2);
    assert.equal(kink, KINK);
  });

  it("should return base rate at 0% utilization", async function () {
    const rate = await irModel.read.getBorrowRate([0n]);
    assert.equal(rate, BASE_RATE);
  });

  it("should calculate correct rate below kink (linear part)", async function () {
    // 50% utilization
    const utilization = 5n * (10n ** 17n); // 0.5 * 10^18
    const expectedRate = BASE_RATE + (utilization * SLOPE1) / E18;
    const rate = await irModel.read.getBorrowRate([utilization]);

    assert.equal(rate, expectedRate);
  });

  it("should calculate correct rate at kink", async function () {
    const expectedRate = BASE_RATE + (KINK * SLOPE1) / E18;
    const rate = await irModel.read.getBorrowRate([KINK]);

    assert.equal(rate, expectedRate);
  });

  it("should calculate correct rate above kink (with slope2)", async function () {
    // 90% utilization
    const utilization = 9n * (10n ** 17n); // 0.9 * 10^18
    const excess = utilization - KINK;
    const expectedRate =
      BASE_RATE +
      (KINK * SLOPE1) / E18 +
      (excess * SLOPE2) / E18;
    const rate = await irModel.read.getBorrowRate([utilization]);

    assert.equal(rate, expectedRate);
  });

  it("should return 100% rate at 100% utilization", async function () {
    const utilization = E18;
    const excess = E18 - KINK;
    const expectedRate =
      BASE_RATE +
      (KINK * SLOPE1) / E18 +
      (excess * SLOPE2) / E18;
    const rate = await irModel.read.getBorrowRate([utilization]);

    assert.equal(rate, expectedRate);
  });

  it("should revert if kink > 100%", async function () {
    // kink 超过 1e18 应该 revert
    await assert.rejects(
      viemInstance.deployContract("InterestRateModel", [
        BASE_RATE,
        SLOPE1,
        SLOPE2,
        11n * (10n ** 17n), // 110% - 超过 100%
      ])
    );
  });
});
