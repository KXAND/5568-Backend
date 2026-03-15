// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract InterestRateModel {
  // All rates are per-block, scaled by 1e18
  uint256 public immutable baseRate;
  uint256 public immutable slope1;
  uint256 public immutable slope2;
  uint256 public immutable kink;

  constructor(uint256 _baseRate, uint256 _slope1, uint256 _slope2, uint256 _kink) {
    require(_kink <= 1e18, "IRM: bad kink");
    baseRate = _baseRate;
    slope1 = _slope1;
    slope2 = _slope2;
    kink = _kink;
  }

  // utilization: 1e18 = 100%
  function getBorrowRate(uint256 utilization) external view returns (uint256) {
    if (utilization <= kink) {
      return baseRate + (utilization * slope1) / 1e18;
    }
    uint256 excess = utilization - kink;
    return baseRate + (kink * slope1) / 1e18 + (excess * slope2) / 1e18;
  }
}
