# Flashloan

## Recent Changes
- Added the frontend-relevant swap configuration entry point: `FlashLoanSwap.setExchangeRate(...)`.

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

### Setters

- `addLiquidity(address token, uint256 amount)` (OnlyOwner)
  File: `contracts/Flashloan/FlashLoanSwap.sol`
  Purpose: add swap liquidity for one supported token.
  Inputs: `token`: supported token address. `amount`: token amount.

- `removeLiquidity(address token, uint256 amount)` (OnlyOwner)
  File: `contracts/Flashloan/FlashLoanSwap.sol`
  Purpose: remove swap liquidity for one supported token.
  Inputs: `token`: supported token address. `amount`: token amount.

- `setExchangeRate(uint256 _exchangeRate)` (OnlyOwner)
  File: `contracts/Flashloan/FlashLoanSwap.sol`
  Purpose: update the swap exchange rate used by the bot after collateral seizure.
  Inputs: `_exchangeRate`: rate scaled by `1e18`.
  Notes: this is the live swap-configuration setter after deployment; `_exchangeRate` must be greater than `0`.

## Notes

- The flash bot targets a `debtVaultId`, not a borrower wallet address.
- Operator tooling should only call the bot after verifying the target vault is liquidatable.
