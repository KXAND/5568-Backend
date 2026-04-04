# Contract API Reference

This document is the full contract-side API reference.
All token amounts use 18 decimals unless stated otherwise (`1e18 = 1`).

---

## AliceToken / BobToken (ERC20)

Files:

- `contracts/token/AliceToken.sol`
- `contracts/token/BobToken.sol`

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
  Output: total token supply.

- `balanceOf(address account) -> uint256`
  Purpose: return the token balance of an account.
  Inputs: `account`: wallet address.
  Output: token balance.

- `allowance(address owner, address spender) -> uint256`
  Purpose: return the approved spending amount.
  Inputs: `owner`: token owner. `spender`: approved spender.
  Output: allowance amount.

### Public Functions

- `transfer(address to, uint256 amount) -> bool`
  Purpose: transfer tokens from caller to another address.
  Inputs: `to`: receiver. `amount`: token amount.
  Output: `true` on success.

- `approve(address spender, uint256 amount) -> bool`
  Purpose: approve another address to spend caller tokens.
  Inputs: `spender`: approved spender. `amount`: allowance amount.
  Output: `true` on success.

- `transferFrom(address from, address to, uint256 amount) -> bool`
  Purpose: transfer tokens using allowance.
  Inputs: `from`: source. `to`: receiver. `amount`: token amount.
  Output: `true` on success.

- `mint(address to, uint256 amount)` (only owner)
  Purpose: mint new tokens.
  Inputs: `to`: receiver. `amount`: token amount.
  Output: none.

---

## AliceFaucet / BobFaucet

Files:

- `contracts/token/AliceToken.sol`
- `contracts/token/BobToken.sol`

### Getters

- `token() -> address`
  Purpose: return the token contract address managed by the faucet.
  Inputs: none.
  Output: token contract address.

- `dripAmount() -> uint256`
  Purpose: return the token amount dispensed per successful claim.
  Inputs: none.
  Output: drip amount.

- `cooldown() -> uint256`
  Purpose: return the cooldown between two claims.
  Inputs: none.
  Output: cooldown in seconds.

- `lastClaimAt(address user) -> uint256`
  Purpose: return the last claim timestamp of a user.
  Inputs: `user`: wallet address.
  Output: Unix timestamp.

### Public Functions

- `claim()`
  Purpose: claim faucet tokens if cooldown has passed.
  Inputs: none.
  Output: none.

- `refill(uint256 amount)` (only owner)
  Purpose: mint more tokens into the faucet.
  Inputs: `amount`: token amount.
  Output: none.

---

## PoolCoin (Reserve aToken)

File: `contracts/PoolCoin.sol`

### Getters

- `name() -> string`
  Purpose: return the aToken name.
  Inputs: none.
  Output: token name.

- `symbol() -> string`
  Purpose: return the aToken symbol.
  Inputs: none.
  Output: token symbol.

- `totalSupply() -> uint256`
  Purpose: return total aToken share supply for one reserve.
  Inputs: none.
  Output: aToken share supply.

- `balanceOf(address account) -> uint256`
  Purpose: return aToken shares held by an address.
  Inputs: `account`: wallet address.
  Output: aToken share balance.

- `allowance(address owner, address spender) -> uint256`
  Purpose: return approved aToken allowance.
  Inputs: `owner`: token owner. `spender`: approved spender.
  Output: allowance amount.

- `pool() -> address`
  Purpose: return the LendingPool allowed to mint and burn.
  Inputs: none.
  Output: pool address.

### Public Functions

- `transfer(address to, uint256 amount) -> bool`
  Purpose: transfer wallet-held aToken shares.
  Inputs: `to`: receiver. `amount`: aToken shares.
  Output: `true` on success.

- `approve(address spender, uint256 amount) -> bool`
  Purpose: approve wallet-held aToken allowance.
  Inputs: `spender`: approved spender. `amount`: aToken shares.
  Output: `true` on success.

- `transferFrom(address from, address to, uint256 amount) -> bool`
  Purpose: transfer wallet-held aToken shares using allowance.
  Inputs: `from`: source. `to`: receiver. `amount`: aToken shares.
  Output: `true` on success.

- `setPool(address newPool)` (only owner)
  Purpose: update the LendingPool address.
  Inputs: `newPool`: new pool address.
  Output: none.

- `mint(address to, uint256 amount)` (only pool)
  Purpose: mint reserve aToken shares.
  Inputs: `to`: receiver. `amount`: aToken shares.
  Output: none.

- `burn(address from, uint256 amount)` (only pool)
  Purpose: burn reserve aToken shares.
  Inputs: `from`: share owner. `amount`: aToken shares.
  Output: none.

---

## SimpleOracle

File: `contracts/Oracle.sol`

### Getters

- `getPrice(address asset) -> uint256`
  Purpose: return the current oracle price of an asset.
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
  Purpose: return the slope before kink.
  Inputs: none.
  Output: rate per block, scaled by `1e18`.

- `slope2() -> uint256`
  Purpose: return the slope after kink.
  Inputs: none.
  Output: rate per block, scaled by `1e18`.

- `kink() -> uint256`
  Purpose: return the kink utilization.
  Inputs: none.
  Output: utilization ratio, scaled by `1e18`.

### Public Functions

- `getBorrowRate(uint256 utilization) -> uint256`
  Purpose: calculate borrow rate from utilization.
  Inputs: `utilization`: utilization ratio, scaled by `1e18`.
  Output: borrow rate per block, scaled by `1e18`.

---

## LendingPool

File: `contracts/LendingPool.sol`

### Constants

- `RAY() -> uint256`
  Purpose: return the base unit for price and ratio calculations.
  Output: constant `1e18`.

- `BPS() -> uint256`
  Purpose: return the denominator for basis point calculations.
  Output: constant `10_000`.

### Getters

#### State

- `oracle() -> address`
  Purpose: return the current oracle contract.
  Inputs: none.
  Output: oracle address.

- `liquidationBonus() -> uint256`
  Purpose: return liquidation bonus in basis points.
  Inputs: none.
  Output: basis points.

- `nextDebtVaultId() -> uint256`
  Purpose: return the next debtVault id to be assigned.
  Inputs: none.
  Output: next debtVault id.

#### Reserve

- `reserves(address asset) -> (...)`
  Purpose: return reserve configuration and accounting fields for one asset.
  Inputs: `asset`: reserve asset address.
  Output: reserve flags, thresholds, indexes, aToken address, and rate model address.

- `isReserveAsset(address asset) -> bool`
  Purpose: return whether an asset has been registered as a reserve.
  Inputs: `asset`: token address.
  Output: `true` or `false`.

- `getReserveAToken(address asset) -> address`
  Purpose: return the reserve-specific aToken address.
  Inputs: `asset`: reserve asset address.
  Output: aToken address.

- `getReserveAssets() -> address[]`
  Purpose: return all registered reserve assets.
  Inputs: none.
  Output: reserve asset list.

- `getReserveUtilization(address asset) -> uint256`
  Purpose: return current utilization of a reserve.
  Inputs: `asset`: reserve asset address.
  Output: utilization ratio, scaled by `1e18`.

#### DebtVault

- `getOwnerDebtVaultIds(address owner) -> uint256[]`
  Purpose: return all debtVault ids owned by a user.
  Inputs: `owner`: wallet address.
  Output: debtVault id list.

- `healthFactor(uint256 debtVaultId) -> uint256`
  Purpose: return health factor of one debtVault.
  Inputs: `debtVaultId`: debtVault id.
  Output: health factor. `>= 1e18` means safe.

- `getDebtVaultHealthFactor(uint256 debtVaultId) -> uint256`
  Purpose: same as `healthFactor`, kept as an explicit getter.
  Inputs: `debtVaultId`: debtVault id.
  Output: health factor.

- `getDebtVaultValues(uint256 debtVaultId) -> (uint256 maxBorrowableValue, uint256 liquidationThresholdValue, uint256 debtValue)`
  Purpose: return the debtVault borrow capacity, liquidation-adjusted collateral value, and debt value.
  Inputs: `debtVaultId`: debtVault id.
  Output: values scaled by oracle prices.

- `getDebtVaultSummary(uint256 debtVaultId) -> (address borrower, bool active, uint256 hf, uint256 liquidationThresholdValue, uint256 debtValue, uint256 maxBorrowableValue)`
  Purpose: return a compact debtVault summary.
  Inputs: `debtVaultId`: debtVault id.
  Output: borrower, status, health factor, liquidation threshold value, debt value, max borrowable value.

- `getDebtVaultCollateralShares(uint256 debtVaultId, address asset) -> uint256`
  Purpose: return locked collateral shares for one debtVault and asset.
  Inputs: `debtVaultId`: debtVault id. `asset`: reserve asset.
  Output: aToken shares.

- `getDebtVaultCollateralAssetAmount(uint256 debtVaultId, address asset) -> uint256`
  Purpose: return current asset amount of locked collateral aToken shares.
  Inputs: `debtVaultId`: debtVault id. `asset`: reserve asset.
  Output: asset amount.

- `getDebtVaultDebtAmount(uint256 debtVaultId, address asset) -> uint256`
  Purpose: return current debt amount of one asset inside one debtVault.
  Inputs: `debtVaultId`: debtVault id. `asset`: borrowed asset.
  Output: debt amount.

- `getDebtVaultCollateralAssets(uint256 debtVaultId) -> address[]`
  Purpose: return the collateral asset list of a debtVault.
  Inputs: `debtVaultId`: debtVault id.
  Output: asset address list.

- `getDebtVaultBorrowedAssets(uint256 debtVaultId) -> address[]`
  Purpose: return the borrowed asset list of a debtVault.
  Inputs: `debtVaultId`: debtVault id.
  Output: asset address list.

#### User

- `getUserCustodiedShares(address user, address asset) -> uint256`
  Purpose: return reserve aToken shares held in pool custody for a user.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: aToken shares.

- `getUserLockedShares(address user, address asset) -> uint256`
  Purpose: return how many custodied shares are locked as collateral.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: aToken shares.

- `getUserClaimableShares(address user, address asset) -> uint256`
  Purpose: return custodied aToken shares that are not locked and can be claimed.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: aToken shares.

- `getUserDebtBalance(address user, address asset) -> uint256`
  Purpose: return total debt of one asset across all debtVaults owned by a user.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: debt amount.

### Public Functions

#### Reserve Management (only owner)

- `addReserve(address asset, address interestRateModel, bool canBeCollateral, bool canBeBorrowed, uint256 ltv, uint256 liquidationThreshold, string aTokenName, string aTokenSymbol)`
  Purpose: register a new reserve and deploy its aToken.
  Inputs: reserve asset, rate model, collateral/borrow flags, risk parameters, aToken metadata.
  Output: none.

- `setReserveConfig(address asset, bool canBeCollateral, bool canBeBorrowed, uint256 ltv, uint256 liquidationThreshold)`
  Purpose: update reserve risk configuration.
  Inputs: reserve asset and new flags/thresholds.
  Output: none.

- `setInterestRateModel(address asset, address newModel)`
  Purpose: update the reserve rate model.
  Inputs: `asset`: reserve asset. `newModel`: new model address.
  Output: none.

- `setOracle(address newOracle)`
  Purpose: update the oracle contract.
  Inputs: `newOracle`: oracle address.
  Output: none.

- `setLiquidationBonus(uint256 _bonus)`
  Purpose: update liquidation bonus.
  Inputs: `_bonus`: basis points.
  Output: none.

- `fundReserve(address asset, uint256 amount)`
  Purpose: add extra asset liquidity to a reserve without minting user aToken shares.
  Inputs: `asset`: reserve asset. `amount`: asset amount.
  Output: none.

#### Deposit & Withdraw

- `deposit(address asset, uint256 amount)`
  Purpose: deposit asset into one reserve and mint custodied aToken shares for the caller.
  Inputs: `asset`: reserve asset. `amount`: asset amount.
  Output: none.

- `withdraw(address asset, uint256 amount)`
  Purpose: withdraw asset from the caller's claimable custodied deposit.
  Inputs: `asset`: reserve asset. `amount`: asset amount.
  Output: none.

- `claimAToken(address asset, uint256 shares, address to)`
  Purpose: move claimable custodied aToken shares out to a wallet.
  Inputs: `asset`: reserve asset. `shares`: aToken shares. `to`: receiver address.
  Output: none.

- `recustodyAToken(address asset, uint256 shares)`
  Purpose: move wallet-held aToken shares back into pool custody.
  Inputs: `asset`: reserve asset. `shares`: aToken shares.
  Output: none.

#### DebtVault

- `openDebtVault() -> uint256`
  Purpose: create a new debtVault for the caller.
  Inputs: none.
  Output: new debtVault id.

- `depositCollateral(uint256 debtVaultId, address asset, uint256 amount)`
  Purpose: move claimable deposited aToken shares into one debtVault as collateral.
  Inputs: `debtVaultId`: debtVault id. `asset`: collateral asset. `amount`: asset amount to convert from deposited balance.
  Output: none.

- `withdrawCollateral(uint256 debtVaultId, address asset, uint256 amount)`
  Purpose: move collateral from a debtVault back to normal deposited balance if health factor remains valid.
  Inputs: `debtVaultId`: debtVault id. `asset`: collateral asset. `amount`: asset amount to convert from collateral.
  Output: none.

#### Borrow & Repay

- `borrow(uint256 debtVaultId, address asset, uint256 amount)`
  Purpose: borrow one reserve asset against one debtVault.
  Inputs: `debtVaultId`: debtVault id. `asset`: borrowed asset. `amount`: asset amount.
  Output: none.

- `repay(uint256 debtVaultId, address asset, uint256 amount)`
  Purpose: repay one reserve debt inside one debtVault.
  Inputs: `debtVaultId`: debtVault id. `asset`: debt asset. `amount`: repay amount.
  Output: none.

#### Liquidation

- `liquidate(uint256 debtVaultId, address debtAsset, address collateralAsset, uint256 repayAmount)`
  Purpose: liquidate an unhealthy debtVault by repaying one debt asset and seizing one collateral asset.
  Inputs: `debtVaultId`: target debtVault. `debtAsset`: asset being repaid. `collateralAsset`: asset being seized. `repayAmount`: requested repay amount.
  Output: none.
