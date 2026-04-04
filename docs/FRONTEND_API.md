# Frontend Integration Guide

This document only lists the interfaces that the frontend is expected to call directly.
All token amounts use 18 decimals unless stated otherwise (`1e18 = 1`).

---

## AliceFaucet / BobFaucet

Files:

- `contracts/token/AliceToken.sol`
- `contracts/token/BobToken.sol`

### Getters

- `token() -> address`
  Version: 0.0.1
  Purpose: return the token contract address.
  Inputs: none.
  Output: token contract address.

- `dripAmount() -> uint256`
  Version: 0.0.1
  Purpose: return how many tokens one successful claim gives.
  Inputs: none.
  Output: drip amount.

- `cooldown() -> uint256`
  Version: 0.0.1
  Purpose: return the minimum waiting time between two claims.
  Inputs: none.
  Output: cooldown in seconds.

- `lastClaimAt(address user) -> uint256`
  Version: 0.0.1
  Purpose: return the last claim timestamp of a user.
  Inputs: `user`: wallet address.
  Output: Unix timestamp (seconds).

### Public Functions

- `claim()`
  Version: 0.0.1
  Purpose: claim free faucet tokens to msg.sender if the cooldown has passed.
  Inputs: none.
  Output: none.

---

## AliceToken / BobToken

### Getters

- `balanceOf(address account) -> uint256`
  Version: 0.0.1
  Purpose: return the token balance of an account.
  Inputs: `account`: wallet address.
  Output: token balance.

- `allowance(address owner, address spender) -> uint256`
  Version: 0.0.1
  Purpose: return how many tokens `spender` is allowed to spend from `owner`.
  Inputs: `owner`: token owner address. `spender`: approved spender address.
  Output: allowance amount.

### Public Functions

- `approve(address spender, uint256 amount) -> bool`
  Version: 0.0.1
  Purpose: allow another address to spend the caller's tokens.
  Inputs: `spender`: approved address. `amount`: token amount.
  Output: `true` if approval succeeds.

- `transfer(address to, uint256 amount) -> bool`
  Version: 0.0.1
  Purpose: send tokens from the caller to another address.
  Inputs: `to`: receiver address. `amount`: token amount.
  Output: `true` if transfer succeeds.

---

## PoolCoin

File: `contracts/PoolCoin.sol`

### Getters

- `balanceOf(address account) -> uint256`
  Version: 0.0.1
  Purpose: return how many PoolCoin shares an account owns.
  Inputs: `account`: wallet address.
  Output: aToken share balance.

- `totalSupply() -> uint256`
  Version: 0.0.1
  Purpose: return current total supply of receipt shares.
  Inputs: none.
  Output: total aToken share supply.

### Public Functions

- `transfer(address to, uint256 amount) -> bool`
  Version: 0.0.1
  Purpose: transfer PoolCoin shares.
  Inputs: `to`: receiver address. `amount`: aToken shares.
  Output: `true` if transfer succeeds.

- `approve(address spender, uint256 amount) -> bool`
  Version: 0.0.1
  Purpose: approve PoolCoin share spending.
  Inputs: `spender`: approved address. `amount`: aToken shares.
  Output: `true` if approval succeeds.

---

## SimpleOracle

File: `contracts/Oracle.sol`

### Getters

- `getPrice(address asset) -> uint256`
  Version: 0.0.1
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
  Version: 0.0.1
  Purpose: return the base borrow rate.
  Inputs: none.
  Output: rate per block, scaled by `1e18`.

- `slope1() -> uint256`
  Version: 0.0.1
  Purpose: return the interest slope below kink.
  Inputs: none.
  Output: rate per block, scaled by `1e18`.

- `slope2() -> uint256`
  Version: 0.0.1
  Purpose: return the interest slope above kink.
  Inputs: none.
  Output: rate per block, scaled by `1e18`.

- `kink() -> uint256`
  Version: 0.0.1
  Purpose: return the utilization threshold where the slope changes.
  Inputs: none.
  Output: utilization ratio, scaled by `1e18`.

### Public Functions

- `getBorrowRate(uint256 utilization) -> uint256`
  Version: 0.0.1
  Purpose: calculate the borrow rate for a utilization value.
  Inputs: `utilization`: utilization ratio, scaled by `1e18`.
  Output: borrow rate per block, scaled by `1e18`.

---

## LendingPool

File: `contracts/LendingPool.sol`

### Getters

#### Constants

- `RAY() -> uint256`
  Version: 0.0.1
  Purpose: return the base unit for price and ratio calculations.
  Output: constant `1e18`.

- `BPS() -> uint256`
  Version: 0.0.1
  Purpose: return the denominator for basis point calculations.
  Output: constant `10_000`.

#### State

- `oracle() -> address`
  Version: 0.0.1
  Purpose: return the current oracle contract.
  Inputs: none.
  Output: oracle address.

- `liquidationBonus() -> uint256`
  Version: 0.0.1
  Purpose: return liquidation bonus in basis points.
  Inputs: none.
  Output: basis points.

- `nextDebtVaultId() -> uint256`
  Version: 0.0.1
  Purpose: return the next debtVault id to be assigned.
  Inputs: none.
  Output: next debtVault id.

#### Reserve

- `getReserveAssets() -> address[]`
  Version: 0.0.1
  Purpose: return all supported reserve assets.
  Inputs: none.
  Output: reserve asset list.

- `getReserveUtilization(address asset) -> uint256`
  Version: 0.0.1
  Purpose: return reserve utilization.
  Inputs: `asset`: reserve asset.
  Output: utilization ratio, scaled by `1e18`.

- `getReserveAToken(address asset) -> address`
  Version: 0.0.1
  Purpose: return the aToken address for one reserve.
  Inputs: `asset`: reserve asset.
  Output: aToken address.

#### DebtVault

- `getOwnerDebtVaultIds(address owner) -> uint256[]`
  Version: 0.0.1
  Purpose: return all debtVault ids owned by the user.
  Inputs: `owner`: user wallet address.
  Output: debtVault id list.

- `healthFactor(uint256 debtVaultId) -> uint256`
  Version: 0.0.1
  Purpose: return the health factor of the debtVault.
  Inputs: `debtVaultId`: debtVault id.
  Output: health factor. `>= 1e18` means safe.

- `getDebtVaultHealthFactor(uint256 debtVaultId) -> uint256`
  Version: 0.0.1
  Purpose: same as `healthFactor`, kept as an explicit getter.
  Inputs: `debtVaultId`: debtVault id.
  Output: health factor.

- `getDebtVaultValues(uint256 debtVaultId) -> (uint256 maxBorrowableValue, uint256 liquidationThresholdValue, uint256 debtValue)`
  Version: 0.0.1
  Purpose: return the debtVault borrow capacity, liquidation-adjusted collateral value, and debt value.
  Inputs: `debtVaultId`: debtVault id.
  Output: values scaled by oracle prices.

- `getDebtVaultSummary(uint256 debtVaultId) -> (address borrower, bool active, uint256 hf, uint256 liquidationThresholdValue, uint256 debtValue, uint256 maxBorrowableValue)`
  Version: 0.0.1
  Purpose: return summary information of one debtVault.
  Inputs: `debtVaultId`: debtVault id.
  Output: borrower, status, health factor, liquidation threshold value, debt value, max borrowable value.

- `getDebtVaultCollateralShares(uint256 debtVaultId, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return locked collateral aToken shares for one debtVault and asset.
  Inputs: `debtVaultId`: debtVault id. `asset`: reserve asset.
  Output: aToken shares.

- `getDebtVaultCollateralAssetAmount(uint256 debtVaultId, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return current asset amount of collateral for one asset inside one debtVault.
  Inputs: `debtVaultId`: debtVault id. `asset`: reserve asset.
  Output: asset amount.

- `getDebtVaultDebtAmount(uint256 debtVaultId, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return current debt amount for one asset inside one debtVault.
  Inputs: `debtVaultId`: debtVault id. `asset`: reserve asset.
  Output: debt amount.

- `getDebtVaultCollateralAssets(uint256 debtVaultId) -> address[]`
  Version: 0.0.1
  Purpose: return which assets are currently used as collateral by one debtVault.
  Inputs: `debtVaultId`: debtVault id.
  Output: asset address list.

- `getDebtVaultBorrowedAssets(uint256 debtVaultId) -> address[]`
  Version: 0.0.1
  Purpose: return which assets are currently borrowed by one debtVault.
  Inputs: `debtVaultId`: debtVault id.
  Output: asset address list.

#### User

- `getUserCustodiedShares(address user, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return reserve aToken shares currently held in pool custody for the user.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: aToken shares.

- `getUserLockedShares(address user, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return reserve aToken shares currently locked as collateral.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: aToken shares.

- `getUserClaimableShares(address user, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return reserve aToken shares that can still be claimed to wallet.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: aToken shares.

- `getUserDebtBalance(address user, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return total debt of one asset across all debtVaults owned by the user.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: debt amount.

### Public Functions

#### Reserve Management (only owner)

- `addReserve(address asset, address interestRateModel, bool canBeCollateral, bool canBeBorrowed, uint256 ltv, uint256 liquidationThreshold, string aTokenName, string aTokenSymbol)`
  Version: 0.0.1
  Purpose: register a new reserve and deploy its aToken.
  Inputs: reserve asset, rate model, collateral/borrow flags, risk parameters, aToken metadata.
  Output: none.

- `setReserveConfig(address asset, bool canBeCollateral, bool canBeBorrowed, uint256 ltv, uint256 liquidationThreshold)`
  Version: 0.0.1
  Purpose: update reserve risk configuration.
  Inputs: reserve asset and new flags/thresholds.
  Output: none.

- `setInterestRateModel(address asset, address newModel)`
  Version: 0.0.1
  Purpose: update the reserve rate model.
  Inputs: `asset`: reserve asset. `newModel`: new model address.
  Output: none.

- `setOracle(address newOracle)`
  Version: 0.0.1
  Purpose: update the oracle contract.
  Inputs: `newOracle`: oracle address.
  Output: none.

- `setLiquidationBonus(uint256 _bonus)`
  Version: 0.0.1
  Purpose: update liquidation bonus.
  Inputs: `_bonus`: basis points.
  Output: none.

- `fundReserve(address asset, uint256 amount)`
  Version: 0.0.1
  Purpose: add extra asset liquidity to a reserve without minting user aToken shares.
  Inputs: `asset`: reserve asset. `amount`: asset amount.
  Output: none.

#### Deposit & Withdraw

- `deposit(address asset, uint256 amount)`
  Version: 0.0.1
  Purpose: deposit asset into one reserve and mint custodied aToken shares for the caller.
  Inputs: `asset`: reserve asset. `amount`: asset amount.
  Output: none.

- `withdraw(address asset, uint256 amount)`
  Version: 0.0.1
  Purpose: withdraw asset from the user's unencumbered deposited balance.
  Inputs: `asset`: reserve asset. `amount`: asset amount.
  Output: none.

#### Wallet & Custody

- `claimAToken(address asset, uint256 shares, address to)`
  Version: 0.0.1
  Purpose: move claimable custodied reserve aToken shares to a wallet.
  Inputs: `asset`: reserve asset. `shares`: aToken shares. `to`: receiver.
  Output: none.

- `recustodyAToken(address asset, uint256 shares)`
  Version: 0.0.1
  Purpose: move wallet-held aToken shares of one asset back into pool custody.
  Inputs: `asset`: reserve asset. `shares`: aToken shares.
  Output: none.

#### DebtVault

- `openDebtVault() -> uint256`
  Version: 0.0.1
  Purpose: create a new debtVault.
  Inputs: none.
  Output: new debtVault id.

- `depositCollateral(uint256 debtVaultId, address asset, uint256 amount)`
  Version: 0.0.1
  Purpose: move deposited aToken shares of one asset into one debtVault as collateral.
  Inputs: `debtVaultId`: debtVault id. `asset`: collateral asset. `amount`: asset amount to convert from deposited balance.
  Output: none.

- `withdrawCollateral(uint256 debtVaultId, address asset, uint256 amount)`
  Version: 0.0.1
  Purpose: move collateral aToken shares from one debtVault back to deposited balance if health factor remains valid.
  Inputs: `debtVaultId`: debtVault id. `asset`: collateral asset. `amount`: asset amount to convert from collateral.
  Output: none.

#### Borrow & Repay

- `borrow(uint256 debtVaultId, address asset, uint256 amount)`
  Version: 0.0.1
  Purpose: borrow one reserve asset against one debtVault.
  Inputs: `debtVaultId`: debtVault id. `asset`: debt asset. `amount`: asset amount.
  Output: none.

- `repay(uint256 debtVaultId, address asset, uint256 amount)`
  Version: 0.0.1
  Purpose: repay one reserve debt in one debtVault.
  Inputs: `debtVaultId`: debtVault id. `asset`: debt asset. `amount`: asset amount.
  Output: none.

#### Liquidation

- `liquidate(uint256 debtVaultId, address debtAsset, address collateralAsset, uint256 repayAmount)`
  Version: 0.0.1
  Purpose: liquidate an unhealthy debtVault by repaying one debt asset and seizing one collateral asset.
  Inputs: `debtVaultId`: target debtVault. `debtAsset`: asset being repaid. `collateralAsset`: asset being seized. `repayAmount`: asset amount to repay.
  Output: none.

### Frontend Notes

- `deposit`, `repay`, and `liquidate` require ERC20 approval on the asset token first.
- `depositCollateral`, `withdraw`, and `withdrawCollateral` do not require ERC20 approval.
- `withdraw` still depends on available reserve liquidity.
- `depositCollateral` and `withdrawCollateral` only move deposited aToken shares in and out of a debtVault. They do not transfer the asset token directly.
- Claimed wallet-held aTokens are not used as active collateral until the user explicitly sends them back with `recustodyAToken`.
- Only claimable custodied aToken shares can be sent out with `claimAToken`.
- Reserve onboarding and risk configuration are owner-only flows and are intentionally not listed here as normal frontend actions.
