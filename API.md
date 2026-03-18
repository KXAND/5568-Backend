# API Documentation

This document describes each public function with purpose and inputs/outputs.
All token amounts use 18 decimals unless stated otherwise (i.e., 1e18 = 1).

---

## AliceToken (ERC20)

File: `contracts/AliceToken.sol`

- `name() -> string`
  Purpose: token name.
  Inputs: none.
  Output: name string.

- `symbol() -> string`
  Purpose: token symbol.
  Inputs: none.
  Output: symbol string.

- `decimals() -> uint8`
  Purpose: token decimals (18).
  Inputs: none.
  Output: decimals.

- `totalSupply() -> uint256`
  Purpose: total supply.
  Inputs: none.
  Output: total supply.

- `balanceOf(address account) -> uint256`
  Purpose: get balance of an account.
  Inputs: account address.
  Output: balance.

- `allowance(address owner, address spender) -> uint256`
  Purpose: get allowance.
  Inputs: owner, spender.
  Output: allowance.

- `transfer(address to, uint256 amount) -> bool`
  Purpose: transfer tokens.
  Inputs: to, amount.
  Output: success boolean.

- `approve(address spender, uint256 amount) -> bool`
  Purpose: approve spender.
  Inputs: spender, amount.
  Output: success boolean.

- `transferFrom(address from, address to, uint256 amount) -> bool`
  Purpose: transfer on behalf of `from`.
  Inputs: from, to, amount.
  Output: success boolean.

- `mint(address to, uint256 amount)` (only owner)
  Purpose: mint tokens.
  Inputs: to, amount.
  Output: none.

## AliceFaucet

File: `contracts/AliceToken.sol`

- `token() -> address`
  Purpose: token address.
  Inputs: none.
  Output: AliceToken address.

- `dripAmount() -> uint256`
  Purpose: fixed amount per claim.
  Inputs: none.
  Output: drip amount.

- `cooldown() -> uint256`
  Purpose: minimum seconds between claims.
  Inputs: none.
  Output: cooldown seconds.

- `lastClaimAt(address user) -> uint256`
  Purpose: last claim timestamp.
  Inputs: user address.
  Output: timestamp.

- `claim()`
  Purpose: claim free tokens if cooldown passed.
  Inputs: none.
  Output: none.

- `refill(uint256 amount)` (only owner)
  Purpose: mint more tokens into faucet.
  Inputs: amount.
  Output: none.

---

## BobToken (ERC20)

File: `contracts/BobToken.sol`

Same ERC20 functions as AliceToken.

## BobFaucet

File: `contracts/BobToken.sol`

Same faucet functions as AliceFaucet.

---

## PoolCoin (Deposit Receipt Token)

File: `contracts/PoolCoin.sol`

Standard ERC20 functions plus:

- `pool() -> address`
  Purpose: current pool address.
  Inputs: none.
  Output: pool address.

- `setPool(address newPool)` (only owner)
  Purpose: update pool address.
  Inputs: newPool.
  Output: none.

- `mint(address to, uint256 amount)` (only pool)
  Purpose: mint shares.
  Inputs: to, amount.
  Output: none.

- `burn(address from, uint256 amount)` (only pool)
  Purpose: burn shares.
  Inputs: from, amount.
  Output: none.

---

## SimpleOracle

File: `contracts/Oracle.sol`

- `setPrice(address asset, uint256 price)` (only owner)
  Purpose: set asset price.
  Inputs: asset address, price.
  Output: none.

- `getPrice(address asset) -> uint256`
  Purpose: read asset price.
  Inputs: asset address.
  Output: price.

Price is scaled by 1e18.

---

## InterestRateModel (Kinked)

File: `contracts/InterestRate.sol`

- `baseRate() -> uint256`
  Purpose: base rate.
  Inputs: none.
  Output: base rate per block.

- `slope1() -> uint256`
  Purpose: slope below kink.
  Inputs: none.
  Output: slope1 per block.

- `slope2() -> uint256`
  Purpose: slope above kink.
  Inputs: none.
  Output: slope2 per block.

- `kink() -> uint256`
  Purpose: kink utilization.
  Inputs: none.
  Output: kink (1e18 = 100%).

- `getBorrowRate(uint256 utilization) -> uint256`
  Purpose: borrow rate for given utilization.
  Inputs: utilization (1e18 = 100%).
  Output: rate per block.

All rates are per-block, scaled by 1e18.

---

## LendingPool

File: `contracts/LendingPool.sol`

### Read

- `collateralToken() -> address`
  Purpose: collateral token.
  Inputs: none.
  Output: token address.

- `borrowToken() -> address`
  Purpose: borrow token.
  Inputs: none.
  Output: token address.

- `poolCoin() -> address`
  Purpose: PoolCoin address.
  Inputs: none.
  Output: token address.

- `oracle() -> address`
  Purpose: oracle address.
  Inputs: none.
  Output: address.

- `interestRateModel() -> address`
  Purpose: interest model.
  Inputs: none.
  Output: address.

- `ltv() -> uint256`
  Purpose: loan-to-value.
  Inputs: none.
  Output: LTV (1e18 = 100%).

- `totalBorrows() -> uint256`
  Purpose: total borrows with interest.
  Inputs: none.
  Output: total borrows.

- `borrowIndex() -> uint256`
  Purpose: borrow index.
  Inputs: none.
  Output: index.

- `liquidityIndex() -> uint256`
  Purpose: liquidity index.
  Inputs: none.
  Output: index.

- `getUtilization() -> uint256`
  Purpose: utilization ratio.
  Inputs: none.
  Output: utilization (1e18 = 100%).

- `healthFactor(address user) -> uint256`
  Purpose: user health factor.
  Inputs: user address.
  Output: health factor (>= 1e18 is safe).

### Write

- `deposit(uint256 amount)`
  Purpose: deposit collateral and mint shares.
  Inputs: amount (collateral token units).
  Output: none.

- `withdraw(uint256 amount)`
  Purpose: withdraw collateral and burn shares.
  Inputs: amount (collateral token units).
  Output: none.

- `borrow(uint256 amount)`
  Purpose: borrow from pool.
  Inputs: amount (borrow token units).
  Output: none.

- `repay(uint256 amount)`
  Purpose: repay debt.
  Inputs: amount (borrow token units).
  Output: none.

- `fundBorrowToken(uint256 amount)` (only owner)
  Purpose: add borrow token liquidity.
  Inputs: amount.
  Output: none.

- `setLtv(uint256 newLtv)` (only owner)
  Purpose: update LTV.
  Inputs: newLtv (1e18 = 100%).
  Output: none.

- `setOracle(address newOracle)` (only owner)
  Purpose: update oracle.
  Inputs: newOracle address.
  Output: none.

- `setInterestRateModel(address newModel)` (only owner)
  Purpose: update interest rate model.
  Inputs: newModel address.
  Output: none.

### Frontend Notes

- `deposit`/`withdraw` uses PoolCoin shares internally; UI uses underlying token amounts.
- `healthFactor >= 1e18` means safe. Below 1e18 is unsafe.
- `borrow`/`repay` require `borrowToken` approvals.
- `deposit`/`withdraw` require `collateralToken` approvals.
