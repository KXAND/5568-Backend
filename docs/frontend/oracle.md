# Oracle

## Recent Changes

## Overview

This module contains `SimpleOracle`. It stays in the frontend docs for admin / operator tooling, but it is not part of the normal end-user flow.

## SimpleOracle

The owner-managed price store used by LendingPool.

### Getters

- `getPrice(address asset) -> uint256`
  File: `contracts/Oracle.sol`
  Inputs: `asset`: token address.
  Returns: current price scaled by `1e18`.

### Setters (OnlyOwner)

- `setPrice(address asset, uint256 price)`
  File: `contracts/Oracle.sol`
  Purpose: set the price of one asset.
  Inputs: `asset`: token address. `price`: price scaled by `1e18`.
