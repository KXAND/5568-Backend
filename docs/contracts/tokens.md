# Tokens

## Recent Changes

## Overview

This module contains `AliceToken`, `BobToken`, the two local faucet contracts, `AToken`, `IssuedToken`, and `TokenIssuer`.

## AliceToken / BobToken

The two base ERC20 assets used in local and test flows.

### Getters

- `name() -> string`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Returns: token name.

- `symbol() -> string`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Returns: token symbol.

- `decimals() -> uint8`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Returns: token decimals, usually `18`.

- `totalSupply() -> uint256`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Returns: current total supply.

- `balanceOf(address account) -> uint256`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Inputs: `account`: wallet address.
  Returns: token balance.

- `allowance(address owner, address spender) -> uint256`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Inputs: `owner`: token owner address. `spender`: approved spender address.
  Returns: allowance amount.

### Functions

- `transfer(address to, uint256 amount) -> bool`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Purpose: transfer tokens from the caller to another address.
  Inputs: `to`: receiver address. `amount`: token amount.
  Returns: `true` on success.

- `approve(address spender, uint256 amount) -> bool`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Purpose: approve another address to spend the caller's tokens.
  Inputs: `spender`: approved spender address. `amount`: allowance amount.
  Returns: `true` on success.

- `transferFrom(address from, address to, uint256 amount) -> bool`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Purpose: transfer tokens using an existing allowance.
  Inputs: `from`: source address. `to`: receiver address. `amount`: token amount.
  Returns: `true` on success.

### Setters

- `mint(address to, uint256 amount)` (OnlyOwner)
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Purpose: mint new tokens.
  Inputs: `to`: receiver address. `amount`: token amount.

## AliceFaucet / BobFaucet

Simple cooldown-based faucets. Each faucet deploys and owns its own `AliceToken` or `BobToken` instance.

### Getters

- `token() -> address`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Returns: token contract address managed by the faucet.

- `dripAmount() -> uint256`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Returns: token amount dispensed per successful claim.

- `cooldown() -> uint256`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Returns: cooldown in seconds between two claims.

- `lastClaimAt(address user) -> uint256`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Inputs: `user`: wallet address.
  Returns: last claim timestamp.

### Functions

- `claim()`
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Purpose: claim faucet tokens if the cooldown has passed.

### Setters

- `refill(uint256 amount)` (OnlyOwner)
  File: `contracts/token/AliceToken.sol`, `contracts/token/BobToken.sol`
  Purpose: mint more faucet inventory into the faucet contract.
  Inputs: `amount`: token amount.

## AToken

The reserve receipt-share token minted by LendingPool.

### Getters

- `name() -> string`
  File: `contracts/AToken.sol`
  Returns: aToken name.

- `symbol() -> string`
  File: `contracts/AToken.sol`
  Returns: aToken symbol.

- `decimals() -> uint8`
  File: `contracts/AToken.sol`
  Returns: token decimals, usually `18`.

- `totalSupply() -> uint256`
  File: `contracts/AToken.sol`
  Returns: total aToken share supply for one reserve.

- `balanceOf(address account) -> uint256`
  File: `contracts/AToken.sol`
  Inputs: `account`: wallet address.
  Returns: aToken share balance.

- `allowance(address owner, address spender) -> uint256`
  File: `contracts/AToken.sol`
  Inputs: `owner`: token owner address. `spender`: approved spender address.
  Returns: allowance amount.

- `pool() -> address`
  File: `contracts/AToken.sol`
  Returns: LendingPool address allowed to mint and burn.

### Functions

- `transfer(address to, uint256 amount) -> bool`
  File: `contracts/AToken.sol`
  Purpose: transfer wallet-held aToken shares.
  Inputs: `to`: receiver address. `amount`: aToken share amount.
  Returns: `true` on success.

- `approve(address spender, uint256 amount) -> bool`
  File: `contracts/AToken.sol`
  Purpose: approve spending of wallet-held aToken shares.
  Inputs: `spender`: approved spender address. `amount`: aToken share amount.
  Returns: `true` on success.

- `transferFrom(address from, address to, uint256 amount) -> bool`
  File: `contracts/AToken.sol`
  Purpose: transfer aToken shares using an existing allowance.
  Inputs: `from`: source address. `to`: receiver address. `amount`: aToken share amount.
  Returns: `true` on success.

### Setters

- `setPool(address newPool)` (OnlyOwner)
  File: `contracts/AToken.sol`
  Purpose: update the LendingPool address.
  Inputs: `newPool`: new pool address.

- `mint(address to, uint256 amount)` (OnlyPool)
  File: `contracts/AToken.sol`
  Purpose: mint reserve aToken shares.
  Inputs: `to`: receiver address. `amount`: aToken share amount.

- `burn(address from, uint256 amount)` (OnlyPool)
  File: `contracts/AToken.sol`
  Purpose: burn reserve aToken shares.
  Inputs: `from`: share owner address. `amount`: aToken share amount.

## IssuedToken

An ERC20 created by TokenIssuer.

### Getters

- `name() -> string`
  File: `contracts/helpers/tokenIssuer.sol`
  Returns: token name.

- `symbol() -> string`
  File: `contracts/helpers/tokenIssuer.sol`
  Returns: token symbol.

- `decimals() -> uint8`
  File: `contracts/helpers/tokenIssuer.sol`
  Returns: token decimals, usually `18`.

- `totalSupply() -> uint256`
  File: `contracts/helpers/tokenIssuer.sol`
  Returns: current total supply.

- `balanceOf(address account) -> uint256`
  File: `contracts/helpers/tokenIssuer.sol`
  Inputs: `account`: wallet address.
  Returns: token balance.

- `allowance(address owner, address spender) -> uint256`
  File: `contracts/helpers/tokenIssuer.sol`
  Inputs: `owner`: token owner address. `spender`: approved spender address.
  Returns: allowance amount.

- `owner() -> address`
  File: `contracts/helpers/tokenIssuer.sol`
  Returns: current token owner.

### Functions

- `transfer(address to, uint256 amount) -> bool`
  File: `contracts/helpers/tokenIssuer.sol`
  Purpose: transfer tokens from the caller to another address.
  Inputs: `to`: receiver address. `amount`: token amount.
  Returns: `true` on success.

- `approve(address spender, uint256 amount) -> bool`
  File: `contracts/helpers/tokenIssuer.sol`
  Purpose: approve another address to spend the caller's tokens.
  Inputs: `spender`: approved spender address. `amount`: allowance amount.
  Returns: `true` on success.

- `transferFrom(address from, address to, uint256 amount) -> bool`
  File: `contracts/helpers/tokenIssuer.sol`
  Purpose: transfer tokens using an existing allowance.
  Inputs: `from`: source address. `to`: receiver address. `amount`: token amount.
  Returns: `true` on success.

### Setters

- `mint(address to, uint256 amount)` (OnlyOwner)
  File: `contracts/helpers/tokenIssuer.sol`
  Purpose: mint new issued tokens.
  Inputs: `to`: receiver address. `amount`: token amount.

## TokenIssuer

A helper that issues arbitrary ERC20s and can also act as a faucet for them.

### Getters

- `owner() -> address`
  File: `contracts/helpers/tokenIssuer.sol`
  Returns: owner of the issuer helper.

- `faucetConfigs(address token) -> (uint256 dripAmount, uint256 cooldown, bool enabled)`
  File: `contracts/helpers/tokenIssuer.sol`
  Inputs: `token`: issued token address.
  Returns: faucet drip amount, cooldown, and whether faucet mode is enabled.

- `lastClaimAt(address token, address user) -> uint256`
  File: `contracts/helpers/tokenIssuer.sol`
  Inputs: `token`: issued token address. `user`: wallet address.
  Returns: last faucet claim timestamp for one user on one issued token.

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
  Returns: issued token address, or zero address if not found.

### Functions

- `claim(address token)`
  File: `contracts/helpers/tokenIssuer.sol`
  Purpose: claim faucet tokens for one issued token if faucet mode is enabled and cooldown has passed.
  Inputs: `token`: issued token address.

### Setters

- `issueToken(string name_, string symbol_, address owner_, address initialRecipient, uint256 initialSupply) -> address`
  File: `contracts/helpers/tokenIssuer.sol`
  Purpose: deploy a new mintable ERC20 token and register it inside the issuer.
  Inputs: `name_`: token name. `symbol_`: token symbol. `owner_`: token owner address. `initialRecipient`: address receiving the initial supply. `initialSupply`: amount minted on deployment.
  Returns: new token address.
  Notes: current implementation is permissionless, this is a current bug.

- `issueTokenWithFaucet(string name_, string symbol_, uint256 initialSupply, uint256 dripAmount, uint256 cooldown) -> address`
  File: `contracts/helpers/tokenIssuer.sol`
  Purpose: deploy a new ERC20 token owned by the issuer itself and enable helper-managed faucet claims on it.
  Inputs: `name_`: token name. `symbol_`: token symbol. `initialSupply`: amount minted into issuer custody. `dripAmount`: amount dispensed per claim. `cooldown`: minimum seconds between claims.
  Returns: new token address.
  Notes: current implementation is permissionless, this is a current bug.

- `refill(address token, uint256 amount)` (OnlyOwner)
  File: `contracts/helpers/tokenIssuer.sol`
  Purpose: mint more faucet inventory for one issued token managed by the issuer.
  Inputs: `token`: issued token address. `amount`: token amount.

## Notes

- `AliceFaucet` and `BobFaucet` each deploy a fresh token instance with the same name and symbol as the corresponding asset.
- `AToken` balances are shares. Underlying asset amount must be reconstructed with the reserve liquidity index.
- Current bug / known limitation: `issueToken` and `issueTokenWithFaucet` are permissionless in the current implementation.
- `TokenIssuer` stays in this module even though its source file is under `contracts/helpers/`, because it is token-facing tooling.
