# DeFi Project Backend

Backend repository for our DeFi lending protocol project on Ethereum.

## Before You Start

Please read [GIT_RULES.md](./GIT_RULES.md) first and follow it during development. Frontend integration guide: [FRONTEND_API.md](./docs/FRONTEND_API.md)

## Targets

Basic:

- [x] A lending pool where users can **supply**, **withdraw**, **borrow**, and **repay**
- [x] Over-collateralization logic
- [x] Interest rate model (kinked)
  - [x] Dynamic interest rate model based on utilization rate
  - [x] Accrue interest per block (lenders and borrowers)
- [x] Oracle (simple fixed-price)

Bonus:

- [x] Liquidation mechanism:
  - [x] Allow a third party to liquidate a position when health factor < 1
  - [x] Liquidation Spread/Bonus
- [x] Flash Loan
- [x] Real Oracle
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

### Run Test

Start a local node:

```shell
pnpm exec hardhat node
```

Then run all test:

```shell
pnpm exec hardhat test --network localhost
```

Or only use TypeScript test:

```shell
pnpm exec hardhat test nodejs --network localhost
```

Or only use Solidity test:

```shell
pnpm exec hardhat test solidity --network localhost
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

