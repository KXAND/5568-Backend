# Flashloan

## Recent Changes

## Overview

These contracts are not normal retail-user entry points. Frontend usually only reads bot-related configuration and, if exposing operator tooling, calls the bot entry.

## FlashLoanBot

Uses a flash loan to liquidate one debt vault and repay in the same transaction.

### Getters

- `flashPool() -> address`
  File: `contracts/Flashloan/FlashLoanBot.sol`
  Returns: linked flash-loan pool address.

- `lendingPool() -> address`
  File: `contracts/Flashloan/FlashLoanBot.sol`
  Returns: linked lending-pool address.

- `swap() -> address`
  File: `contracts/Flashloan/FlashLoanBot.sol`
  Returns: linked swap address.

### Functions

- `borrow(address token, uint256 amount, uint256 debtVaultId, address collateralAsset)`
  File: `contracts/Flashloan/FlashLoanBot.sol`
  Purpose: trigger the flash-loan liquidation strategy against one unhealthy debt vault.
  Inputs: `token`: flash-loaned debt asset. `amount`: flash-loan amount. `debtVaultId`: target debt-vault id. `collateralAsset`: collateral asset to seize and swap.

## FlashLoanPool

Holds Alice and Bob liquidity and sends flash loans.

### Getters

- `feeRate() -> uint256`
  File: `contracts/Flashloan/FlashLoanPool.sol`
  Returns: flash-loan fee rate in basis points.

- `getBalance(address token) -> uint256`
  File: `contracts/Flashloan/FlashLoanPool.sol`
  Inputs: `token`: supported token address.
  Returns: pool balance of that token.

## FlashLoanSwap

A simple Alice-BOB swap used by the flash-loan bot after liquidation.

### Getters

- `exchangeRate() -> uint256`
  File: `contracts/Flashloan/FlashLoanSwap.sol`
  Returns: current swap exchange rate scaled by `1e18`.

- `getAliceToBobAmount(uint256 aliceAmount) -> uint256`
  File: `contracts/Flashloan/FlashLoanSwap.sol`
  Inputs: `aliceAmount`: Alice input amount.
  Returns: quoted Bob output amount.

- `getBobToAliceAmount(uint256 bobAmount) -> uint256`
  File: `contracts/Flashloan/FlashLoanSwap.sol`
  Inputs: `bobAmount`: Bob input amount.
  Returns: quoted Alice output amount.

- `getPoolStatus() -> (uint256 aliceBalance, uint256 bobBalance)`
  File: `contracts/Flashloan/FlashLoanSwap.sol`
  Returns: current Alice and Bob liquidity balances.

- `getStats() -> (uint256 aliceTotal, uint256 bobTotal)`
  File: `contracts/Flashloan/FlashLoanSwap.sol`
  Returns: cumulative Alice and Bob swap volumes.

## Notes

- The flash bot targets a `debtVaultId`, not a borrower wallet address.
- Operator tooling should only call the bot after verifying the target vault is liquidatable.
