## Data-Driven Dynamic Testing

You can now provide a JSON scenario file and let the script execute the whole backend test flow automatically.

All dynamic testing test, launchers, helpers, and JSON data files are grouped under `test/scenarios`.

Main files in this folder:

- `test/scenarios/launch-scenario.mjs`: launcher for `pnpm run scenario` and `pnpm run scenario:local`
- `test/scenarios/run.ts`: scenario entrypoint
- `test/scenarios/data-driven.ts`: main dynamic-testing executor
- `test/scenarios/deploy.ts`: reusable deployment helper for dynamic testing
- `test/scenarios/data/*.json`: scenario data files

Run the default scenario:

```shell
pnpm run scenario
```

Run with your own test data file:

```shell
pnpm run scenario -- path/to/your-scenario.json
```

If you want to use a local node, start `pnpm exec hardhat node` first and then run:

```shell
pnpm run scenario:local -- path/to/your-scenario.json
```

Sample data file: `test/scenarios/data/default.json`

pnpm run scenario -- test/scenarios/data/default.json

Default example flow in `test/scenarios/data/default.json`:

1. Deposit Alice into the pool.
2. Use Alice as collateral.
3. Borrow Bob from the lending pool.
4. Apply a price change that pushes the position into the liquidatable range.
5. Test normal liquidation.
6. Test flash-loan liquidation.
7. Test repeated flash-loan liquidations until the vault becomes healthy again.
8. Let the borrower repay the remaining debt and withdraw the remaining collateral.


Rules for the data file:

- Token amounts and prices are decimal strings with 18 decimals implied, such as `"100"`, `"1"`, `"0.985"`.
- If you need exact wei input, use a string ending with `wei`, such as `"985000000000000000wei"`.
- Supported scenario types are `borrow-health`, `direct-liquidation`, `flash-liquidation`, `multi-flash-liquidation`, and `incentives`.
- Wallet aliases `A`, `B`, `C`, `D` map to the first four Hardhat test accounts.

### Scenario Type Explanation

- `borrow-health`: create a borrowing position and verify that the final health factor stays above a target. Useful for testing normal collateral and borrow combinations without triggering liquidation.
- `direct-liquidation`: create a vault, apply a price drop, then let a liquidator repay debt directly through the lending pool. Useful for checking whether unhealthy positions can be liquidated and whether collateral shares are seized correctly.
- `flash-liquidation`: create a vault, apply a price drop, and use the flash loan bot to liquidate in a single transaction. Useful for checking flash loan repayment, swap flow, and flash fee collection.
- `multi-flash-liquidation`: repeat flash liquidations until the vault health factor returns above a target. Useful for cases where one liquidation is not enough to restore a healthy position.
- `incentives`: trigger withdraw and repay actions with time advancement, then verify reward accrual and claim behavior. Useful for testing liquidity mining or governance token rewards.

### Common Scenario Fields

- `name`: the title printed in the terminal for that test step.
- `borrower`: which Hardhat account opens the vault, using `A`, `B`, `C`, or `D`.
- `caller` or `liquidator`: which account sends the liquidation transaction.
- `collateralAsset` and `borrowAsset`: which asset is used as collateral and which asset is borrowed. Supported values are `alice` and `bob`.
- `collateralAmount` and `borrowAmount`: generic asset-aware amount fields used by the current scenario runner.
- `collateralBob` and `borrowAlice`: older shorthand fields kept for backward compatibility with the original Bob-collateral / Alice-borrow examples.
- `healthyAlicePrice` and `healthyBobPrice`: asset prices before any crash or liquidation step begins.
- `priceAfterAlice` and `priceAfterBob`: asset prices after the crash. Use these when you want explicit per-asset price control.
- `priceAfter`: legacy shorthand for changing the Bob price only.
- `flashBorrowAmount`: how much of the debt asset the flash-loan bot borrows for liquidation.
- `maxIterations`: upper bound for repeated flash-liquidation attempts.
- `exitPositionAfterRecovery`: after the scenario reaches its final position state, let the borrower repay any remaining debt and withdraw any remaining collateral. This works for normal borrow-health flows as well as liquidation flows.
- `expect`: assertion settings for that step, such as minimum health factor, whether debt must go down, or whether rewards must increase.

### Setup Section Explanation

- `initialAlicePrice` and `initialBobPrice`: global prices set before individual scenarios begin.
- `reserveAlice`: initial ALC liquidity deposited into the lending pool so borrowing can succeed.
- `reserveBob`: initial BOB liquidity deposited into the lending pool so borrowing can succeed when Bob is the debt asset.
- `flashAlice`: initial ALC liquidity deposited into the flash loan pool.
- `flashBob`: initial BOB liquidity deposited into the flash loan pool.
- `swapAlice` and `swapBob`: initial liquidity added to the swap contract for liquidation routing.
- `swapExchangeRate`: swap price used by the simple flash-loan swap contract.
- `claimAliceFaucetFor` and `claimBobFaucetFor`: which test accounts should receive faucet tokens before scenarios run.
- `aliceReserveConfig` and `bobReserveConfig`: reserve permissions and risk parameters used before scenarios start, including whether an asset can be collateralized or borrowed.

Or connect Remix to your local node:

1. Open [Remix](https://remix.ethereum.org) or launch your Remix Desktop
2. Open `Deploy & Run Transactions`
3. Select `Dev - Hardhat Provider`
4. If needed, set the URL to `http://127.0.0.1:8545`
