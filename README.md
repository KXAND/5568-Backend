# DeFi Project Backend

Backend repository for our DeFi lending protocol project on Ethereum.

## Before You Start

Please read [GIT_RULES.md](./GIT_RULES.md) first and follow it during development. Frontend integration guide: [FRONTEND_API.md](./docs/FRONTEND_API.md)

## Targets (PM not finalized yet)

Basic:

- [x] A lending pool where users can **supply**, **withdraw**, **borrow**, and **repay**
- [x] Over-collateralization logic
- [x] Interest rate model (kinked)
  - [x] Dynamic interest rate model based on utilization rate
  - [x] Accrue interest per block (lenders and borrowers)
- [] Oracle (simple fixed-price)

Bonus:

- [ ] Liquidation mechanism:
  - [ ] Allow a third party to liquidate a position when health factor < 1
  - [ ] Liquidation Spread/Bonus
- [ ] Flash Loan
- [ ] Real Oracle
- [x] Advanced tokenomics: issue a governance token (like COMP or AAVE) as a reward for lenders/borrowers (liquidity mining)
- [ ] ~~Analytics & UX~~

---

## Development Setup

- Use **Remix** (recommended)
- Use VS Code + Hardhat3 when needed

## Repository Layout

- `contracts/`: Solidity contracts
- `test/`: automated tests
- `scripts/`: manual interaction scripts
- `ignition/`: deployment modules
- `.vscode/`: shared debug/task configs

## VS Code + Hardhat Commands

Please use `pnpm` as your package manager. You can install it by:

```shell
npm install -g pnpm@latest-10
```

Install dependencies:

```shell
pnpm install
```

Compile contracts:

```shell
pnpm exec hardhat compile
```

Run tests:

```shell
pnpm exec hardhat test
```

### Run a Script on a Fresh EVM

For example, to run `scripts/deploy.ts`:

```shell
pnpm exec hardhat run scripts/deploy.ts --network hardhatMainnet
```

### Run a Script on Localhost

Start a local node:

```shell
pnpm exec hardhat node
```

Then run a TypeScript script on localhost. For example:

```shell
pnpm exec hardhat run scripts/play.ts --network localhost
```

Or connect Remix to your local node:

1. Open [Remix](https://remix.ethereum.org) or launch your Remix Desktop
2. Open `Deploy & Run Transactions`
3. Select `Dev - Hardhat Provider`
4. If needed, set the URL to `http://127.0.0.1:8545`
