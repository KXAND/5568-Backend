# Oracle

## Recent Changes

## Overview

This module contains `SimpleOracle`.

## SimpleOracle

The owner-managed price store used by LendingPool.

### Getters

- `getPrice(address asset) -> uint256`
  File: `contracts/Oracle.sol`
  Inputs: `asset`: token address.
  Returns: current price scaled by `1e18`.

### Setters

- `setPrice(address asset, uint256 price)` (OnlyOwner)
  File: `contracts/Oracle.sol`
  Purpose: set the spot price of one asset.
  Inputs: `asset`: token address. `price`: price scaled by `1e18`.
