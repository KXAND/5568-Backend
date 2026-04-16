# Interest Rate Model

## Recent Changes

## Overview

This module contains `InterestRateModel`.

## InterestRateModel

The kinked borrow-rate model used by reserves.

### Getters

- `baseRate() -> uint256`
  File: `contracts/InterestRate.sol`
  Returns: base borrow rate per block, scaled by `1e18`.

- `slope1() -> uint256`
  File: `contracts/InterestRate.sol`
  Returns: pre-kink slope per block, scaled by `1e18`.

- `slope2() -> uint256`
  File: `contracts/InterestRate.sol`
  Returns: post-kink slope per block, scaled by `1e18`.

- `kink() -> uint256`
  File: `contracts/InterestRate.sol`
  Returns: kink utilization threshold scaled by `1e18`.

### Functions

- `getBorrowRate(uint256 utilization) -> uint256`
  File: `contracts/InterestRate.sol`
  Purpose: calculate borrow rate for one utilization value.
  Inputs: `utilization`: utilization ratio scaled by `1e18`.
  Returns: borrow rate per block, scaled by `1e18`.
