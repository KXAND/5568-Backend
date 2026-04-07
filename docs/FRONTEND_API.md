# Frontend Integration Guide

This document only lists the interfaces that the frontend is expected to call directly.
All token amounts use 18 decimals unless stated otherwise (`1e18 = 1`).

---

## AliceFaucet / BobFaucet

Files:

- `contracts/AliceToken.sol`
- `contracts/BobToken.sol`

### Getters

- `token() -> address`
  Purpose: return the AliceToken contract address.
  Inputs: none.
  Output: token contract address.

- `dripAmount() -> uint256`
  Purpose: return how many tokens one successful claim gives.
  Inputs: none.
  Output: drip amount.

- `cooldown() -> uint256`
  Purpose: return the minimum waiting time between two claims.
  Inputs: none.
  Output: cooldown in seconds.

- `lastClaimAt(address user) -> uint256`
  Purpose: return the last claim timestamp of a user.
  Inputs: `user`: wallet address.
  Output: Unix timestamp (seconds).

### Public Functions

- `claim()`
  Purpose: claim free Alice tokens to msg.sender if the cooldown has passed.
  Inputs: none.
  Output: none.

---

## AliceToken / BobToken

### Getters

- `balanceOf(address account) -> uint256`
  Purpose: return the token balance of an account.
  Inputs: `account`: wallet address.
  Output: token balance.

- `allowance(address owner, address spender) -> uint256`
  Purpose: return how many tokens `spender` is allowed to spend from `owner`.
  Inputs: `owner`: token owner address. `spender`: approved spender address.
  Output: allowance amount.

### Public Functions

- `approve(address spender, uint256 amount) -> bool`
  Purpose: allow another address to spend the caller's tokens.
  Inputs: `spender`: approved address. `amount`: approved amount.
  Output: `true` if approval succeeds.

- `transfer(address to, uint256 amount) -> bool`
  Purpose: send tokens from the caller to another address.
  Inputs: `to`: receiver address. `amount`: token amount.
  Output: `true` if transfer succeeds.

---

## PoolCoin

File: `contracts/PoolCoin.sol`

### Getters

- `balanceOf(address account) -> uint256`
  Purpose: return how many PoolCoin shares an account owns.
  Inputs: `account`: wallet address.
  Output: share balance.

- `totalSupply() -> uint256`
  Purpose: return current total supply of receipt shares.
  Inputs: none.
  Output: total share supply.

### Public Functions

- `transfer(address to, uint256 amount) -> bool`
  Purpose: transfer PoolCoin shares.
  Inputs: `to`: receiver address. `amount`: share amount.
  Output: `true` if transfer succeeds.

- `approve(address spender, uint256 amount) -> bool`
  Purpose: approve PoolCoin share spending.
  Inputs: `spender`: approved address. `amount`: approved amount.
  Output: `true` if approval succeeds.

---

## SimpleOracle

File: `contracts/Oracle.sol`

### Getters

- `getPrice(address asset) -> uint256`
  Purpose: return the current price of an asset.
  Inputs: `asset`: token address.
  Output: price scaled by `1e18`.

### Public Functions

No frontend-facing write functions in normal user flows.

---

## InterestRateModel

File: `contracts/InterestRate.sol`

### Getters

- `baseRate() -> uint256`
  Purpose: return the base borrow rate.
  Inputs: none.
  Output: rate per block, scaled by `1e18`.

- `slope1() -> uint256`
  Purpose: return the interest slope below kink.
  Inputs: none.
  Output: rate per block, scaled by `1e18`.

- `slope2() -> uint256`
  Purpose: return the interest slope above kink.
  Inputs: none.
  Output: rate per block, scaled by `1e18`.

- `kink() -> uint256`
  Purpose: return the utilization threshold where the slope changes.
  Inputs: none.
  Output: utilization ratio, scaled by `1e18`.

### Public Functions

- `getBorrowRate(uint256 utilization) -> uint256`
  Purpose: calculate the borrow rate for a utilization value.
  Inputs: `utilization`: utilization ratio, scaled by `1e18`.
  Output: borrow rate per block, scaled by `1e18`.

---

## LendingPool

File: `contracts/LendingPool.sol`

### Getters

- `collateralToken() -> address`
  Purpose: return the collateral token contract address.
  Inputs: none.
  Output: token contract address.

- `borrowToken() -> address`
  Purpose: return the borrow token contract address.
  Inputs: none.
  Output: token contract address.

- `poolCoin() -> address`
  Purpose: return the PoolCoin contract address.
  Inputs: none.
  Output: token contract address.

- `ltv() -> uint256`
  Purpose: return the current loan-to-value limit.
  Inputs: none.
  Output: LTV ratio, scaled by `1e18`.

- `totalBorrows() -> uint256`
  Purpose: return total outstanding debt in the pool.
  Inputs: none.
  Output: total debt amount.

- `borrowIndex() -> uint256`
  Purpose: return the borrow-side interest index.
  Inputs: none.
  Output: index, scaled by `1e18`.

- `liquidityIndex() -> uint256`
  Purpose: return the supply-side interest index.
  Inputs: none.
  Output: index, scaled by `1e18`.

- `getUtilization() -> uint256`
  Purpose: return current pool utilization.
  Inputs: none.
  Output: utilization ratio, scaled by `1e18`.

- `healthFactor(address user) -> uint256`
  Purpose: return the health factor of a user.
  Inputs: `user`: wallet address.
  Output: health factor. `>= 1e18` means safe.

- `estimateLiquidationProfit(uint256 repayAmount) -> (uint256 bonus, uint256 collateralOut)`
  Purpose: estimate liquidation reward for a given repay amount.
  Inputs: `repayAmount`: borrow token amount to repay.
  Output: `bonus`: bonus portion. `collateralOut`: estimated collateral received.

- `getAccountInfo(address user) -> (uint256 collateral, uint256 debt, uint256 healthFactor_)`
  Purpose: return a user's collateral, debt, and health factor in one call.
  Inputs: `user`: wallet address.
  Output: `collateral`: collateral amount. `debt`: debt amount. `healthFactor_`: health factor.

### Public Functions

- `deposit(uint256 amount)`
  Purpose: deposit collateral and mint PoolCoin shares.
  Inputs: `amount`: collateral token amount.
  Output: none.

- `withdraw(uint256 amount)`
  Purpose: withdraw collateral and burn PoolCoin shares.
  Inputs: `amount`: collateral token amount.
  Output: none.

- `borrow(uint256 amount)`
  Purpose: borrow borrowToken from the pool.
  Inputs: `amount`: borrow token amount.
  Output: none.

- `repay(uint256 amount)`
  Purpose: repay borrowToken debt.
  Inputs: `amount`: borrow token amount.
  Output: none.

- `liquidate(address borrower, uint256 repayAmount)`
  Purpose: repay a borrower's debt and receive collateral plus bonus if the position is unhealthy.
  Inputs: `borrower`: target borrower address. `repayAmount`: amount of borrow token to repay. `0` means repay full debt.
  Output: none.

### Frontend Notes

- `deposit` requires `collateralToken.approve(poolAddress, amount)` first.
- `repay` and `liquidate` require `borrowToken.approve(poolAddress, amount)` first.
- `withdraw` does not require ERC20 approval, but it will revert if the account becomes unhealthy after withdrawal.
- `borrow` does not require ERC20 approval.
- PoolCoin shares are handled internally when users deposit and withdraw.
- Owner-only functions such as `setLtv`, `setOracle`, and `setInterestRateModel` are intentionally not listed here as normal frontend actions.

---

## FlashLoanPool

File: `contracts/Flashloan/FlashLoanPool.sol`

### Getters

- `aliceToken() -> address`
  Purpose: return the supported Alice token address.
  Inputs: none.
  Output: token contract address.

- `bobToken() -> address`
  Purpose: return the supported Bob token address.
  Inputs: none.
  Output: token contract address.

- `feeRate() -> uint256`
  Purpose: return current flash loan fee rate.
  Inputs: none.
  Output: fee in basis points (`1 = 0.01%`).

- `FEE_BASE() -> uint256`
  Purpose: return fee denominator.
  Inputs: none.
  Output: constant value, currently `10000`.

- `getBalance(address token) -> uint256`
  Purpose: query token liquidity in flash pool.
  Inputs: `token`: Alice or Bob token address.
  Output: current token balance in pool.

### Public Functions

- `deposit(address token, uint256 amount)`
  Purpose: add Alice or Bob liquidity into flash pool.
  Inputs: `token`: token address. `amount`: deposit amount.
  Output: none.

- `flashLoan(address token, uint256 amount, address target, bytes data)`
  Purpose: execute a flash loan and callback.
  Inputs: `token`: borrowed token. `amount`: borrow amount. `target`: receiver/callback contract. `data`: callback payload.
  Output: none.

### Frontend Notes

- `deposit` requires `token.approve(flashPoolAddress, amount)` first.
- `withdraw` and `setFeeRate` are owner-only and are not normal frontend user actions.
- `flashLoan` should normally be triggered through a bot or strategy contract that implements callback logic.

---

## FlashLoanSwap

File: `contracts/Flashloan/FlashLoanSwap.sol`

### Getters

- `aliceToken() -> address`
  Purpose: return Alice token address used by swap pool.
  Inputs: none.
  Output: token contract address.

- `bobToken() -> address`
  Purpose: return Bob token address used by swap pool.
  Inputs: none.
  Output: token contract address.

- `exchangeRate() -> uint256`
  Purpose: return current swap rate.
  Inputs: none.
  Output: rate scaled by `1e18`.

- `owner() -> address`
  Purpose: return swap owner address.
  Inputs: none.
  Output: owner wallet address.

- `totalAliceSwapped() -> uint256`
  Purpose: return cumulative Alice amount swapped.
  Inputs: none.
  Output: total amount.

- `totalBobSwapped() -> uint256`
  Purpose: return cumulative Bob amount swapped.
  Inputs: none.
  Output: total amount.

- `getAliceToBobAmount(uint256 aliceAmount) -> uint256`
  Purpose: quote Bob output for a given Alice input.
  Inputs: `aliceAmount`: Alice input amount.
  Output: Bob output amount.

- `getBobToAliceAmount(uint256 bobAmount) -> uint256`
  Purpose: quote Alice output for a given Bob input.
  Inputs: `bobAmount`: Bob input amount.
  Output: Alice output amount.

- `getPoolStatus() -> (uint256 aliceBalance, uint256 bobBalance)`
  Purpose: return current swap pool balances.
  Inputs: none.
  Output: Alice and Bob balances.

- `getStats() -> (uint256 aliceTotal, uint256 bobTotal)`
  Purpose: return accumulated swap stats.
  Inputs: none.
  Output: total Alice swapped and total Bob swapped.

### Public Functions

- `swapAliceToBob(uint256 aliceAmount)`
  Purpose: swap Alice to Bob using current exchange rate.
  Inputs: `aliceAmount`: Alice input amount.
  Output: none.

- `swapBobToAlice(uint256 bobAmount)`
  Purpose: swap Bob to Alice using current exchange rate.
  Inputs: `bobAmount`: Bob input amount.
  Output: none.

### Frontend Notes

- `swapAliceToBob` requires `aliceToken.approve(swapAddress, aliceAmount)` first.
- `swapBobToAlice` requires `bobToken.approve(swapAddress, bobAmount)` first.
- `addLiquidity`, `removeLiquidity`, and `setExchangeRate` are owner-only and are not normal frontend user actions.

---

## FlashLoanBot

File: `contracts/Flashloan/FlashLoanBot.sol`

### Getters

- `flashPool() -> address`
  Purpose: return linked flash pool contract address.
  Inputs: none.
  Output: contract address.

- `lendingPool() -> address`
  Purpose: return linked lending pool contract address.
  Inputs: none.
  Output: contract address.

- `swap() -> address`
  Purpose: return linked swap contract address.
  Inputs: none.
  Output: contract address.

### Public Functions

- `borrow(address token, uint256 amount, address borrower)`
  Purpose: trigger bot strategy to take flash loan and liquidate target borrower.
  Inputs: `token`: flash-loaned token. `amount`: flash borrow amount. `borrower`: target borrower to liquidate.
  Output: none.

### Frontend Notes

- This contract is strategy-oriented; typical end users do not call it directly in a normal lending UI.
- If exposed in frontend, treat it as an advanced/operator action and validate target borrower health before calling.
