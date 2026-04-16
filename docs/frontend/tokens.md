# Tokens

## Recent Changes

## Overview

This module contains `AliceToken`, `BobToken`, the two local faucet contracts, `AToken`, and `TokenIssuer`.

## AliceFaucet / BobFaucet

Simple cooldown-based faucets. Each faucet deploys and owns its own `AliceToken` or `BobToken` instance.

### Getters

- `token() -> address`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Returns: faucet token address.

- `dripAmount() -> uint256`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Returns: token amount dispensed per claim.

- `cooldown() -> uint256`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Returns: cooldown in seconds.

- `lastClaimAt(address user) -> uint256`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Inputs: `user`: wallet address.
  Returns: last claim timestamp.

### Functions

- `claim()`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Purpose: claim faucet tokens if the cooldown has passed.

## AliceToken / BobToken

The two base ERC20 assets used in local and test flows.

### Getters

- `balanceOf(address account) -> uint256`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Inputs: `account`: wallet address.
  Returns: token balance.

- `allowance(address owner, address spender) -> uint256`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Inputs: `owner`: token owner address. `spender`: approved spender address.
  Returns: allowance amount.

### Functions

- `approve(address spender, uint256 amount) -> bool`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Purpose: approve another address to spend the caller's tokens.
  Inputs: `spender`: approved spender address. `amount`: allowance amount.
  Returns: `true` on success.

- `transfer(address to, uint256 amount) -> bool`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Purpose: transfer tokens from the caller to another address.
  Inputs: `to`: receiver address. `amount`: token amount.
  Returns: `true` on success.

## AToken

The reserve receipt-share token minted by LendingPool.

### Getters

- `balanceOf(address account) -> uint256`
  File: `contracts/AToken.sol`
  Inputs: `account`: wallet address.
  Returns: aToken share balance held in the wallet.

- `allowance(address owner, address spender) -> uint256`
  File: `contracts/AToken.sol`
  Inputs: `owner`: token owner address. `spender`: approved spender address.
  Returns: allowance amount.

- `totalSupply() -> uint256`
  File: `contracts/AToken.sol`
  Returns: total aToken share supply.

### Functions

- `transfer(address to, uint256 amount) -> bool`
  File: `contracts/AToken.sol`
  Purpose: transfer wallet-held aToken shares.
  Inputs: `to`: receiver address. `amount`: aToken share amount.
  Returns: `true` on success.

- `approve(address spender, uint256 amount) -> bool`
  File: `contracts/AToken.sol`
  Purpose: approve another address to spend wallet-held aToken shares.
  Inputs: `spender`: approved spender address. `amount`: aToken share amount.
  Returns: `true` on success.

## TokenIssuer

A helper that issues arbitrary ERC20s and can also act as a faucet for them.

### Getters

- `faucetConfigs(address token) -> (uint256 dripAmount, uint256 cooldown, bool enabled)`
  File: `contracts/helpers/tokenIssuer.sol`
  Inputs: `token`: issued token address.
  Returns: faucet drip amount, cooldown, and whether faucet mode is enabled.

- `lastClaimAt(address token, address user) -> uint256`
  File: `contracts/helpers/tokenIssuer.sol`
  Inputs: `token`: issued token address. `user`: wallet address.
  Returns: last claim timestamp for that user and token.

- `getIssuedTokenCount() -> uint256`
  File: `contracts/helpers/tokenIssuer.sol`
  Returns: number of tokens issued by this helper.

- `getIssuedTokenInfo(uint256 index) -> (string name, string symbol, address token, address owner, address initialRecipient, uint256 initialSupply, bool faucetEnabled, uint256 dripAmount, uint256 cooldown)`
  File: `contracts/helpers/tokenIssuer.sol`
  Inputs: `index`: issued token index.
  Returns: `name`: token name. `symbol`: token symbol. `token`: issued token address. `owner`: token owner. `initialRecipient`: address that received the initial mint. `initialSupply`: deployment mint amount. `faucetEnabled`: whether faucet mode is enabled. `dripAmount`: faucet payout per claim. `cooldown`: faucet cooldown in seconds.

- `getTokenByName(string name_) -> address`
  File: `contracts/helpers/tokenIssuer.sol`
  Inputs: `name_`: token name.
  Returns: token address, or zero address if not found.

### Functions

- `claim(address token)`
  File: `contracts/helpers/tokenIssuer.sol`
  Purpose: claim faucet tokens for one issued token if faucet mode is enabled and cooldown has passed.
  Inputs: `token`: issued token address.

## Notes

- `AliceFaucet` and `BobFaucet` each deploy a fresh token instance with the same name and symbol as the corresponding asset. The faucet token address is not guaranteed to match the reserve token address used by the pool.
- Wallet aToken balance only covers wallet-held shares. For total deposit exposure, prefer `getUserTotalDepositAssetAmount` from `LendingPool`.
- Current bug / known limitation: the contract-side `issueToken` and `issueTokenWithFaucet` functions are permissionless in the current implementation. If intended owner-only, that is not enforced yet.
- `TokenIssuer` stays in this module because it creates and distributes tokens, even though its source file is under `contracts/helpers/`.
