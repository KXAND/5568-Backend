# Documentation Guide

This directory is split into two layers:

- `docs/contracts/`: full contract-side API reference.
- `docs/frontend/`: frontend-facing integration reference.

## Terminology

### Position Model

- `asset`: the underlying ERC20 reserve asset, such as ALC or BOB.
- `reserve`: one asset market configured in `LendingPool`, including its risk params, accounting state, aToken, and rate model.
- `aToken`: the reserve receipt token. Its balance represents reserve shares, not a raw underlying amount.
- `debtVault`: isolated borrowing position owned by one user. One user can own multiple debtVaults.

### Units And Balances

- `amount`: underlying token amount, using 18 decimals unless stated otherwise.
  - `custodied asset amount`: underlying asset amount converted from custodied shares through the current liquidity index.
  - `total deposit asset amount`: total underlying deposit exposure, including pool-custodied shares and wallet-held aToken shares.
- `shares`: reserve receipt shares, usually represented by aToken balances.
  - `custodied shares`: aToken shares tracked inside `LendingPool` custody for a user.
  - `locked shares`: custodied shares currently locked as collateral in a debtVault.
  - `claimable shares`: custodied shares that are not locked and can be moved out with `claimAToken`.
- `debt amount`: current debt after borrow-index accrual.
- `scaled debt`: "shares" on borrow-side. Normalized debt state stored before reconstructing current debt with the latest borrow index.

### Precision Units

- `ray`: `1e18`. fixed-point precision unit used across the protocol for indexes, rates, prices, and health-factor style ratios.
- `bps`: `10_000 bps = 100%`. Basis points unit used for percentage-style configuration.

### Indices And Risk Params

- `liquidity index`: deposit-side reserve index used to convert between underlying asset amount and reserve shares, and to accumulate supply-side interest.
- `borrow index`: borrow-side reserve index used to convert between scaled debt and current debt amount, and to accumulate borrow-side interest.
- `health factor`: vault safety ratio. `>= 1e18` means safe, `< 1e18` means liquidatable.
- `liquidation threshold`: collateral value ratio used when checking whether a debtVault can be liquidated.
- `close factor`: maximum portion of a debt position that can be repaid in a single liquidation.
- `ltv`: loan-to-value ratio used to determine how much a debtVault can borrow against its collateral.
- `reserve factor`: protocol share of borrow interest spread for one reserve.
- `protocol liquidation bonus cut`: protocol share of liquidation bonus shares.

### Incentives

- `reward type`: reward market category configured in `PoolIncentivesController`, currently deposit-side or borrow-side.
- `reward emission`: POOL reward speed configured per asset and reward type, implemented as `emissionPerSecond`.
