# Incentives

## Recent Changes

- 2026/4/17 17:03 fix: deposit and borrow now call handleAction() as expected;

## Overview

This module contains `PoolCoin` and `PoolIncentivesController`.

## PoolCoin

Fixed-supply governance and reward token. Rewards belong to deposit-side and borrow-side positions.

### Getters

- `name() -> string`
  File: `contracts/token/PoolCoin.sol`
  Returns: token name.

- `symbol() -> string`
  File: `contracts/token/PoolCoin.sol`
  Returns: token symbol.

- `decimals() -> uint8`
  File: `contracts/token/PoolCoin.sol`
  Returns: token decimals, usually `18`.

- `totalSupply() -> uint256`
  File: `contracts/token/PoolCoin.sol`
  Returns: current total supply.

- `balanceOf(address account) -> uint256`
  File: `contracts/token/PoolCoin.sol`
  Inputs: `account`: wallet address.
  Returns: token balance.

- `allowance(address owner, address spender) -> uint256`
  File: `contracts/token/PoolCoin.sol`
  Inputs: `owner`: token owner address. `spender`: approved spender address.
  Returns: allowance amount.

### Functions

- `transfer(address to, uint256 amount) -> bool`
  File: `contracts/token/PoolCoin.sol`
  Purpose: transfer POOL from the caller to another address.
  Inputs: `to`: receiver address. `amount`: token amount.
  Returns: `true` on success.

- `approve(address spender, uint256 amount) -> bool`
  File: `contracts/token/PoolCoin.sol`
  Purpose: approve another address to spend the caller's POOL.
  Inputs: `spender`: approved spender address. `amount`: allowance amount.
  Returns: `true` on success.

- `transferFrom(address from, address to, uint256 amount) -> bool`
  File: `contracts/token/PoolCoin.sol`
  Purpose: transfer POOL using an existing allowance.
  Inputs: `from`: source address. `to`: receiver address. `amount`: token amount.
  Returns: `true` on success.

## PoolIncentivesController

Tracks reward emission, reward indexes, and claimable POOL balances.

### Getters

- `RAY() -> uint256`
  File: `contracts/incentives/PoolIncentivesController.sol`
  Returns: reward index precision base unit, constant `1e18`.

- `DEPOSIT_REWARD_TYPE() -> uint8`
  File: `contracts/incentives/PoolIncentivesController.sol`
  Returns: deposit-side reward type id, constant `0`.

- `BORROW_REWARD_TYPE() -> uint8`
  File: `contracts/incentives/PoolIncentivesController.sol`
  Returns: borrow-side reward type id, constant `1`.

- `poolToken() -> address`
  File: `contracts/incentives/PoolIncentivesController.sol`
  Returns: POOL token address.

- `actionHandler() -> address`
  File: `contracts/incentives/PoolIncentivesController.sol`
  Returns: contract allowed to call `handleAction`.

- `unclaimedRewards(address user) -> uint256`
  File: `contracts/incentives/PoolIncentivesController.sol`
  Inputs: `user`: wallet address.
  Returns: accrued but unclaimed POOL amount.

### Functions

- `handleAction(address user, address asset, uint8 rewardType, uint256 totalPrincipal, uint256 userPrincipal)` (OnlyActionHandler)
  File: `contracts/incentives/PoolIncentivesController.sol`
  Purpose: accrue rewards for one user in one reward market using the latest principal state.
  Inputs: `user`: target user address. `asset`: reserve asset. `rewardType`: deposit-side or borrow-side reward type. `totalPrincipal`: total tracked principal in that reward market. `userPrincipal`: user principal tracked in that reward market.

- `claimRewards(address to) -> uint256`
  File: `contracts/incentives/PoolIncentivesController.sol`
  Purpose: claim all currently accrued POOL rewards for `msg.sender`.
  Inputs: `to`: reward receiver address.
  Returns: claimed POOL amount.
  Notes: `to` must be non-zero, and the caller must already have positive `unclaimedRewards`.

### Setters

- `setActionHandler(address newHandler)` (OnlyOwner)
  File: `contracts/incentives/PoolIncentivesController.sol`
  Purpose: update the contract allowed to report reward actions.
  Inputs: `newHandler`: non-zero handler address.

- `configureReward(address asset, uint8 rewardType, uint256 emissionPerSecond)` (OnlyOwner)
  File: `contracts/incentives/PoolIncentivesController.sol`
  Purpose: configure reward emission speed for one asset and reward type.
  Inputs: `asset`: reserve asset. `rewardType`: reward market type. `emissionPerSecond`: POOL emission speed per second.

## Notes

- `POOL` is a fixed-supply token minted once in the `PoolCoin` constructor. `claimRewards` only transfers controller-held balance and does not mint on claim.
- Deposit-side rewards currently follow the user's custodied / pool-held aToken position, not the user's total deposit amount.
- If a user moves deposit ownership out into wallet-held aTokens, `getUserTotalDepositAssetAmount` may still show the full deposit amount, but incentives continue to follow the custodied side only.
