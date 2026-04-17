# Incentives

## Recent Changes

- 2026/4/17 17:03 fix: deposit and borrow now call handleAction() as expected;   

## Overview

This module contains `PoolCoin` and `PoolIncentivesController`.

## PoolCoin

Fixed-supply governance token. Rewards belong to deposit-side and borrow-side positions.

### Getters

- `balanceOf(address account) -> uint256`
  File: `contracts/token/PoolCoin.sol`
  Inputs: `account`: wallet address.
  Returns: POOL balance.

- `allowance(address owner, address spender) -> uint256`
  File: `contracts/token/PoolCoin.sol`
  Inputs: `owner`: token owner address. `spender`: approved spender address.
  Returns: allowance amount.

### Functions

- `approve(address spender, uint256 amount) -> bool`
  File: `contracts/token/PoolCoin.sol`
  Purpose: approve another address to spend the caller's POOL.
  Inputs: `spender`: approved spender address. `amount`: allowance amount.
  Returns: `true` on success.

- `transfer(address to, uint256 amount) -> bool`
  File: `contracts/token/PoolCoin.sol`
  Purpose: transfer POOL from the caller to another address.
  Inputs: `to`: receiver address. `amount`: token amount.
  Returns: `true` on success.

## PoolIncentivesController

Tracks the user's claimable POOL balance and claim entrypoint.

### Getters

- `poolToken() -> address`
  File: `contracts/incentives/PoolIncentivesController.sol`
  Returns: POOL token address used for rewards.

- `unclaimedRewards(address user) -> uint256`
  File: `contracts/incentives/PoolIncentivesController.sol`
  Inputs: `user`: wallet address.
  Returns: accrued but unclaimed POOL amount.

### Functions

- `claimRewards(address to) -> uint256`
  File: `contracts/incentives/PoolIncentivesController.sol`
  Purpose: claim all currently accrued POOL rewards for `msg.sender`.
  Inputs: `to`: reward receiver address.
  Returns: claimed POOL amount.
  Notes: `to` must be non-zero, and the caller must already have positive `unclaimedRewards`.

## Notes

- `POOL` is a fixed-supply token minted once in the `PoolCoin` constructor. Claiming rewards transfers from controller balance and does not mint on claim.
- Deposit-side reward hooks currently run from `deposit` and `withdraw`.
- Borrow-side reward hooks currently run from `borrow` and `repay`.
- Deposit-side rewards currently follow the user's custodied / pool-held aToken position, not the full deposit amount shown by total-deposit views.
- If a user moves deposit ownership out into wallet-held aTokens, incentives still follow the custodied side only.
