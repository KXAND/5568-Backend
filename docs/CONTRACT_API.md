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

## PoolCoin (ERC20)

File: `contracts/token/PoolCoin.sol`

### Getters

- `name() -> string`
  Version: 0.0.1
  Purpose: return the token name.
  Inputs: none.
  Output: token name.

- `symbol() -> string`
  Version: 0.0.1
  Purpose: return the token symbol.
  Inputs: none.
  Output: token symbol.

- `decimals() -> uint8`
  Version: 0.0.1
  Purpose: return token decimals.
  Inputs: none.
  Output: decimals, usually `18`.

- `totalSupply() -> uint256`
  Version: 0.0.1
  Purpose: return current total supply.
  Inputs: none.
  Output: total token supply.

- `balanceOf(address account) -> uint256`
  Version: 0.0.1
  Purpose: return the token balance of an account.
  Inputs: `account`: wallet address.
  Output: token balance.

- `allowance(address owner, address spender) -> uint256`
  Version: 0.0.1
  Purpose: return the approved spending amount.
  Inputs: `owner`: token owner. `spender`: approved spender.
  Output: allowance amount.

### Public Functions

- `transfer(address to, uint256 amount) -> bool`
  Version: 0.0.1
  Purpose: transfer tokens from caller to another address.
  Inputs: `to`: receiver. `amount`: token amount.
  Output: `true` on success.

- `approve(address spender, uint256 amount) -> bool`
  Version: 0.0.1
  Purpose: approve another address to spend caller tokens.
  Inputs: `spender`: approved spender. `amount`: allowance amount.
  Output: `true` on success.

- `transferFrom(address from, address to, uint256 amount) -> bool`
  Version: 0.0.1
  Purpose: transfer tokens using allowance.
  Inputs: `from`: source. `to`: receiver. `amount`: token amount.
  Output: `true` on success.

---

## PoolIncentivesController

File: `contracts/incentives/PoolIncentivesController.sol`

### Getters

- `RAY() -> uint256`
  Version: 0.0.1
  Purpose: return the reward index precision base unit.
  Inputs: none.
  Output: constant `1e18`.

- `DEPOSIT_REWARD_TYPE() -> uint8`
  Version: 0.0.1
  Purpose: return the reward type id used for deposit-side rewards.
  Inputs: none.
  Output: constant `0`.

- `BORROW_REWARD_TYPE() -> uint8`
  Version: 0.0.1
  Purpose: return the reward type id used for borrow-side rewards.
  Inputs: none.
  Output: constant `1`.

- `poolToken() -> address`
  Version: 0.0.1
  Purpose: return the POOL token contract used for rewards.
  Inputs: none.
  Output: token address.

- `actionHandler() -> address`
  Version: 0.0.1
  Purpose: return the contract allowed to call `handleAction`.
  Inputs: none.
  Output: contract address.

- `rewards(bytes32 rewardKey) -> (uint256 index, uint256 emissionPerSecond, uint256 lastUpdateTimestamp)`
  Version: 0.0.1
  Purpose: return reward market state for one asset/rewardType key.
  Inputs: `rewardKey`: `keccak256(abi.encode(asset, rewardType))`.
  Output: index, emission speed, and last update timestamp.

- `userIndex(bytes32 rewardKey, address user) -> uint256`
  Version: 0.0.1
  Purpose: return the reward index last observed by one user for one reward market.
  Inputs: `rewardKey`: reward market key. `user`: wallet address.
  Output: user reward index.

- `unclaimedRewards(address user) -> uint256`
  Version: 0.0.1
  Purpose: return currently accrued but unclaimed POOL rewards for one user.
  Inputs: `user`: wallet address.
  Output: POOL token amount.

### Public Functions

- `setActionHandler(address newHandler)` (only owner)
  Version: 0.0.1
  Purpose: update the contract allowed to report reward actions.
  Inputs: `newHandler`: contract address.
  Output: none.

- `configureReward(address asset, uint8 rewardType, uint256 emissionPerSecond)` (only owner)
  Version: 0.0.1
  Purpose: configure reward emission speed for one asset and reward type.
  Inputs: `asset`: reserve asset. `rewardType`: reward market type. `emissionPerSecond`: POOL emission speed.
  Output: none.

- `handleAction(address user, address asset, uint8 rewardType, uint256 totalPrincipal, uint256 userPrincipal)`
  Version: 0.0.1
  Purpose: accrue rewards for one user in one reward market using the current principal state.
  Inputs: `user`: target user. `asset`: reserve asset. `rewardType`: reward market type. `totalPrincipal`: total tracked principal. `userPrincipal`: user tracked principal.
  Output: none.

- `claimRewards(address to) -> uint256`
  Version: 0.0.1
  Purpose: claim all currently accrued POOL rewards for `msg.sender`.
  Inputs: `to`: reward receiver address.
  Output: claimed POOL amount.

---

## AToken (Reserve aToken)

File: `contracts/AToken.sol`

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

- `DEPOSIT_REWARD_TYPE() -> uint8`
  Version: 0.0.1
  Purpose: return the reward type id used when reporting deposit-side reward actions.
  Inputs: none.
  Output: constant `0`.

- `BORROW_REWARD_TYPE() -> uint8`
  Version: 0.0.1
  Purpose: return the reward type id used when reporting borrow-side reward actions.
  Inputs: none.
  Output: constant `1`.

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

- `poolIncentivesController() -> address`
  Version: 0.0.1
  Purpose: return the incentives controller linked to the lending pool.
  Inputs: none.
  Output: controller address.

#### Reserve

- `reserves(address asset) -> (...)`
  Purpose: return reserve configuration and accounting fields for one asset.
  Inputs: `asset`: reserve asset address.
  Output: reserve flags, thresholds, total borrows, total debt principal, indexes, aToken address, and rate model address.

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

- `getUserCustodiedAssetAmount(address user, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return underlying asset amount converted from the user's custodied shares.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: asset amount.

- `getUserLockedAssetAmount(address user, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return underlying asset amount converted from the user's locked collateral shares.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: asset amount.

- `getUserClaimableAssetAmount(address user, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return underlying asset amount converted from the user's claimable shares.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: asset amount.

- `getUserTotalDepositAssetAmount(address user, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return user's total deposit amount as underlying, including pool-custodied shares and wallet-held aToken shares.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: asset amount.

- `getUserDebtBalance(address user, address asset) -> uint256`
  Purpose: return total debt of one asset across all debtVaults owned by a user.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: debt amount.

- `getUserDebtPrincipal(address user, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return the user's aggregated debt principal for one asset across all debtVaults.
  Inputs: `user`: wallet address. `asset`: reserve asset.
  Output: debt principal.

- `getUserDebtAmount(address user, address asset) -> uint256`
  Version: 0.0.1
  Purpose: return debt amount reconstructed from the user's aggregated debt principal.
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

- `setPoolIncentivesController(address newController)`
  Version: 0.0.1
  Purpose: update the incentives controller contract used by the lending pool.
  Inputs: `newController`: controller address.
  Output: none.

- `setLiquidationBonus(uint256 _bonus)`
  Purpose: update liquidation bonus.
  Inputs: `_bonus`: basis points.
  Output: none.

- `fundReserve(address asset, uint256 amount)`
  Purpose: add extra asset liquidity to a reserve without minting user aToken shares.
  Inputs: `asset`: reserve asset. `amount`: asset amount.
  Output: none.

- `setCloseFactor(uint256 _closeFactor)`
  Version: 0.0.1
  Purpose: update close factor.
  Inputs: `_closeFactor`: new closefactor, not allowed bigger than BPS.
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

- `borrow(address token, uint256 amount, uint256 debtVaultId, address collateralAsset)`
  Purpose: trigger flash loan then liquidation strategy for one debtVault.
  Inputs: `token`: flash-loaned debt asset. `amount`: flash loan amount. `debtVaultId`: target debtVault id. `collateralAsset`: collateral asset to seize and swap.
  Output: none.

- `executeOperation(address token, uint256 amount, uint256 fee, address initiator, bytes data) -> bool`
  Purpose: flash loan callback implementation used by FlashLoanPool.
  Inputs: `token`: flash-loaned debt asset. `amount`: borrowed amount. `fee`: flash fee. `initiator`: flash initiator (currently unused in logic). `data`: encoded `(debtVaultId, collateralAsset)` payload.
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
