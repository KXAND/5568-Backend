# Contract API Reference

This document is the full contract-side API reference.
All token amounts use 18 decimals unless stated otherwise (`1e18 = 1`).

---

## AliceToken / BobToken (ERC20)

File: `contracts/AliceToken.sol`

### Getters

- `name() -> string`
  Purpose: return the token name.
  Inputs: none.
  Output: token name.

- `symbol() -> string`
  Purpose: return the token symbol.
  Inputs: none.
  Output: token symbol.

- `decimals() -> uint8`
  Purpose: return token decimals.
  Inputs: none.
  Output: decimals, usually `18`.

- `totalSupply() -> uint256`
  Purpose: return current total supply.
  Inputs: none.
  Output: total supply.

- `balanceOf(address account) -> uint256`
  Purpose: return the token balance of an account.
  Inputs: `account`: wallet address.
  Output: token balance.

- `allowance(address owner, address spender) -> uint256`
  Purpose: return how many tokens `spender` is allowed to spend from `owner`.
  Inputs: `owner`: token owner address. `spender`: approved spender address.
  Output: allowance amount.

### Public Functions

- `transfer(address to, uint256 amount) -> bool`
  Purpose: send tokens from the caller to another address.
  Inputs: `to`: receiver address. `amount`: token amount.
  Output: `true` if transfer succeeds.

- `approve(address spender, uint256 amount) -> bool`
  Purpose: allow another address to spend the caller's tokens.
  Inputs: `spender`: approved address. `amount`: approved amount.
  Output: `true` if approval succeeds.

- `transferFrom(address from, address to, uint256 amount) -> bool`
  Purpose: transfer tokens from `from` to `to` using allowance.
  Inputs: `from`: source address. `to`: receiver address. `amount`: token amount.
  Output: `true` if transfer succeeds.

- `mint(address to, uint256 amount)` (only owner)
  Purpose: mint new tokens.
  Inputs: `to`: receiver address. `amount`: token amount.
  Output: none.

---

## AliceFaucet / BobFaucet

File:

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
  Output: Unix timestamp.

### Public Functions

- `claim()`
  Purpose: claim free Alice tokens if the cooldown has passed.
  Inputs: none.
  Output: none.

- `refill(uint256 amount)` (only owner)
  Purpose: mint more Alice tokens into the faucet.
  Inputs: `amount`: token amount.
  Output: none.

---

## PoolCoin (Deposit Receipt Token)

File: `contracts/PoolCoin.sol`

### Getters

- `name() -> string`
  Purpose: return the token name.
  Inputs: none.
  Output: token name.

- `symbol() -> string`
  Purpose: return the token symbol.
  Inputs: none.
  Output: token symbol.

- `decimals() -> uint8`
  Purpose: return token decimals.
  Inputs: none.
  Output: decimals, usually `18`.

- `totalSupply() -> uint256`
  Purpose: return current total supply of receipt shares.
  Inputs: none.
  Output: total share supply.

- `balanceOf(address account) -> uint256`
  Purpose: return how many PoolCoin shares an account owns.
  Inputs: `account`: wallet address.
  Output: share balance.

- `allowance(address owner, address spender) -> uint256`
  Purpose: return approved PoolCoin share allowance.
  Inputs: `owner`: token owner address. `spender`: approved spender address.
  Output: allowance amount.

- `pool() -> address`
  Purpose: return the LendingPool address allowed to mint and burn shares.
  Inputs: none.
  Output: pool address.

### Public Functions

- `transfer(address to, uint256 amount) -> bool`
  Purpose: transfer PoolCoin shares.
  Inputs: `to`: receiver address. `amount`: share amount.
  Output: `true` if transfer succeeds.

- `approve(address spender, uint256 amount) -> bool`
  Purpose: approve PoolCoin share spending.
  Inputs: `spender`: approved address. `amount`: approved amount.
  Output: `true` if approval succeeds.

- `transferFrom(address from, address to, uint256 amount) -> bool`
  Purpose: transfer PoolCoin shares using allowance.
  Inputs: `from`: source address. `to`: receiver address. `amount`: share amount.
  Output: `true` if transfer succeeds.

- `setPool(address newPool)` (only owner)
  Purpose: update the LendingPool address.
  Inputs: `newPool`: new pool address.
  Output: none.

- `mint(address to, uint256 amount)` (only pool)
  Purpose: mint receipt shares.
  Inputs: `to`: receiver address. `amount`: share amount.
  Output: none.

- `burn(address from, uint256 amount)` (only pool)
  Purpose: burn receipt shares.
  Inputs: `from`: owner address. `amount`: share amount.
  Output: none.

---

## SimpleOracle

File: `contracts/Oracle.sol`

### Getters

- `getPrice(address asset) -> uint256`
  Purpose: return the current price of an asset.
  Inputs: `asset`: token address.
  Output: price scaled by `1e18`.

### Public Functions

- `setPrice(address asset, uint256 price)` (only owner)
  Purpose: set the price of an asset.
  Inputs: `asset`: token address. `price`: price scaled by `1e18`.
  Output: none.

---

## InterestRateModel (Kinked)

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

- `oracle() -> address`
  Purpose: return the Oracle contract address.
  Inputs: none.
  Output: oracle address.

- `interestRateModel() -> address`
  Purpose: return the interest rate model contract address.
  Inputs: none.
  Output: model address.

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

- `lastAccrualBlock() -> uint256`
  Purpose: return the last block number used for interest accrual.
  Inputs: none.
  Output: block number.

- `userBorrowPrincipal(address user) -> uint256`
  Purpose: return the stored borrow principal of a user.
  Inputs: `user`: wallet address.
  Output: stored principal amount.

- `userBorrowIndex(address user) -> uint256`
  Purpose: return the borrow index snapshot stored for a user.
  Inputs: `user`: wallet address.
  Output: index snapshot.

- `isBorrower(address user) -> bool`
  Purpose: return whether an address has been recorded as a borrower.
  Inputs: `user`: wallet address.
  Output: `true` or `false`.

- `borrowers(uint256 index) -> address`
  Purpose: return one borrower address from the borrower list.
  Inputs: `index`: array index.
  Output: borrower address.

- `liquidationBonus() -> uint256`
  Purpose: return the liquidation bonus rate.
  Inputs: none.
  Output: bonus rate in basis points.

- `liquidationThreshold() -> uint256`
  Purpose: return the health factor threshold used for liquidation.
  Inputs: none.
  Output: threshold, scaled by `1e18`.

- `totalLiquidations() -> uint256`
  Purpose: return the number of liquidations executed so far.
  Inputs: none.
  Output: liquidation count.

- `BONUS_BASE() -> uint256`
  Purpose: return the denominator used for liquidation bonus calculations.
  Inputs: none.
  Output: constant value, currently `10000`.

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

- `getBorrowers() -> address[]`
  Purpose: return the full borrower list.
  Inputs: none.
  Output: borrower address array.

- `getLiquidatableAccounts() -> address[]`
  Purpose: return all currently liquidatable accounts.
  Inputs: none.
  Output: address array.

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

- `fundBorrowToken(uint256 amount)` (only owner)
  Purpose: add borrow token liquidity to the pool.
  Inputs: `amount`: borrow token amount.
  Output: none.

- `setLtv(uint256 newLtv)` (only owner)
  Purpose: update the pool LTV.
  Inputs: `newLtv`: LTV ratio, scaled by `1e18`.
  Output: none.

- `setOracle(address newOracle)` (only owner)
  Purpose: update the Oracle contract.
  Inputs: `newOracle`: new oracle address.
  Output: none.

- `setInterestRateModel(address newModel)` (only owner)
  Purpose: update the interest rate model contract.
  Inputs: `newModel`: new model address.
  Output: none.

- `setLiquidationBonus(uint256 _bonus)` (only owner)
  Purpose: update liquidation bonus.
  Inputs: `_bonus`: bonus in basis points.
  Output: none.

- `setLiquidationThreshold(uint256 _threshold)` (only owner)
  Purpose: update liquidation threshold.
  Inputs: `_threshold`: health factor threshold, scaled by `1e18`.
  Output: none.

---

## FlashLoanPool

File: `contracts/Flashloan/FlashLoanPool.sol`

### Getters

- `aliceToken() -> address`
  Purpose: return the supported Alice token contract.
  Inputs: none.
  Output: token address.

- `bobToken() -> address`
  Purpose: return the supported Bob token contract.
  Inputs: none.
  Output: token address.

- `feeRate() -> uint256`
  Purpose: return current flash loan fee rate.
  Inputs: none.
  Output: fee in basis points (`1 = 0.01%`).

- `FEE_BASE() -> uint256`
  Purpose: return fee denominator used in fee calculation.
  Inputs: none.
  Output: constant value, currently `10000`.

- `owner() -> address`
  Purpose: return contract owner address.
  Inputs: none.
  Output: owner address.

- `getBalance(address token) -> uint256`
  Purpose: return pool balance of supported token.
  Inputs: `token`: Alice or Bob token address.
  Output: token balance in flash pool.

### Public Functions

- `deposit(address token, uint256 amount)`
  Purpose: deposit supported token into flash pool.
  Inputs: `token`: token address. `amount`: deposit amount.
  Output: none.

- `withdraw(address token, uint256 amount)` (only owner)
  Purpose: withdraw supported token from flash pool.
  Inputs: `token`: token address. `amount`: withdraw amount.
  Output: none.

- `flashLoan(address token, uint256 amount, address target, bytes data)`
  Purpose: lend tokens atomically and invoke target callback.
  Inputs: `token`: loan token. `amount`: borrowed amount. `target`: receiver contract. `data`: callback payload.
  Output: none.

- `setFeeRate(uint256 _feeRate)` (only owner)
  Purpose: set flash loan fee rate.
  Inputs: `_feeRate`: fee in basis points, max `500`.
  Output: none.

---

## IFlashLoanReceiver

File: `contracts/Flashloan/FlashLoanPool.sol`

### Public Functions

- `executeOperation(address token, uint256 amount, uint256 fee, address initiator, bytes data) -> bool`
  Purpose: callback interface function that flash loan receiver contracts must implement.
  Inputs: `token`: loan token. `amount`: borrowed amount. `fee`: required fee. `initiator`: original caller of flashLoan. `data`: arbitrary payload.
  Output: `true` on successful execution.

---

## FlashLoanBot

File: `contracts/Flashloan/FlashLoanBot.sol`

### Getters

- `flashPool() -> address`
  Purpose: return bound FlashLoanPool contract.
  Inputs: none.
  Output: contract address.

- `lendingPool() -> address`
  Purpose: return bound LendingPool contract.
  Inputs: none.
  Output: contract address.

- `swap() -> address`
  Purpose: return bound FlashLoanSwap contract.
  Inputs: none.
  Output: contract address.

### Public Functions

- `borrow(address token, uint256 amount, address borrower)`
  Purpose: trigger flash loan then liquidation strategy.
  Inputs: `token`: flash-loaned token. `amount`: flash loan amount. `borrower`: target borrower to liquidate.
  Output: none.

- `executeOperation(address token, uint256 amount, uint256 fee, address initiator, bytes data) -> bool`
  Purpose: flash loan callback implementation used by FlashLoanPool.
  Inputs: `token`: loan token. `amount`: borrowed amount. `fee`: flash fee. `initiator`: flash initiator (currently unused in logic). `data`: encoded borrower address.
  Output: `true` when liquidation, swap, and repayment flow succeeds.

---

## FlashLoanSwap

File: `contracts/Flashloan/FlashLoanSwap.sol`

### Getters

- `aliceToken() -> address`
  Purpose: return configured Alice token contract.
  Inputs: none.
  Output: token address.

- `bobToken() -> address`
  Purpose: return configured Bob token contract.
  Inputs: none.
  Output: token address.

- `exchangeRate() -> uint256`
  Purpose: return current swap exchange rate.
  Inputs: none.
  Output: rate scaled by `1e18`.

- `owner() -> address`
  Purpose: return swap owner address.
  Inputs: none.
  Output: owner address.

- `totalAliceSwapped() -> uint256`
  Purpose: return cumulative Alice volume.
  Inputs: none.
  Output: total Alice swapped.

- `totalBobSwapped() -> uint256`
  Purpose: return cumulative Bob volume.
  Inputs: none.
  Output: total Bob swapped.

- `getAliceToBobAmount(uint256 aliceAmount) -> uint256`
  Purpose: quote Bob output amount.
  Inputs: `aliceAmount`: Alice input amount.
  Output: Bob output amount.

- `getBobToAliceAmount(uint256 bobAmount) -> uint256`
  Purpose: quote Alice output amount.
  Inputs: `bobAmount`: Bob input amount.
  Output: Alice output amount.

- `getPoolStatus() -> (uint256 aliceBalance, uint256 bobBalance)`
  Purpose: return current on-contract liquidity balances.
  Inputs: none.
  Output: Alice and Bob token balances in pool.

- `getStats() -> (uint256 aliceTotal, uint256 bobTotal)`
  Purpose: return cumulative swap statistics.
  Inputs: none.
  Output: total Alice swapped and total Bob swapped.

### Public Functions

- `addLiquidity(address token, uint256 amount)` (only owner)
  Purpose: add token liquidity to swap pool.
  Inputs: `token`: supported token address. `amount`: token amount.
  Output: none.

- `removeLiquidity(address token, uint256 amount)` (only owner)
  Purpose: remove token liquidity from swap pool.
  Inputs: `token`: supported token address. `amount`: token amount.
  Output: none.

- `setExchangeRate(uint256 _exchangeRate)` (only owner)
  Purpose: update swap exchange rate.
  Inputs: `_exchangeRate`: rate scaled by `1e18`.
  Output: none.

- `swapAliceToBob(uint256 aliceAmount)`
  Purpose: swap Alice input to Bob output at current rate.
  Inputs: `aliceAmount`: Alice input amount.
  Output: none.

- `swapBobToAlice(uint256 bobAmount)`
  Purpose: swap Bob input to Alice output at current rate.
  Inputs: `bobAmount`: Bob input amount.
  Output: none.
