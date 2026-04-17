# Incentives

## Recent Changes

## Overview

This module contains `PoolCoin` and `PoolIncentivesController`.

## PoolCoin

Fixed-supply governance token. Rewards belong to deposit-side and borrow-side positions, and the current implementation settles them on `withdraw` and `repay`.

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
- Reward ownership is still deposit-side / borrow-side, but current implementation only settles rewards from `withdraw` and `repay`.
- Current bug / known limitation: reward hooks do not yet cover all position-establishing actions such as `deposit` and `borrow`, so the first baseline sync for one reward market may happen later than intended.
- When one reward market is first touched for one user, the current implementation may only write the user's baseline `userIndex` and not increase `unclaimedRewards` in that call.
