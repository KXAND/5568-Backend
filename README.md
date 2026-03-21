# DeFi Project Backend

Backend repository for our DeFi lending protocol project on Ethereum.

## Before You Start

Please read [GIT_RULES.md](./GIT_RULES.md) first and follow it during development. Frontend integration guide: [API.md](./API.md)

## Targets (PM not finalized yet)

Basic:

- [ ] A lending pool where users can **supply**, **withdraw**, **borrow**, and **repay**
- [ ] Over-collateralization logic
- [ ] Interest rate model (kinked)
  - [ ] Dynamic interest rate model based on utilization rate
  - [ ] Accrue interest per block (lenders and borrowers)
- [ ] Oracle (simple fixed-price)

Bonus:

- [ ] Liquidation mechanism:
  - [ ] Allow a third party to liquidate a position when health factor < 1
  - [ ] Liquidation Spread/Bonus
- [ ] Flash Loan
- [ ] Real Oracle
- [ ] Advanced tokenomics: issue a governance token (like COMP or AAVE) as a reward for lenders/borrowers (liquidity mining)
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

Install dependencies:

```powershell
pnpm install
```

Compile:

```powershell
pnpm exec hardhat compile
```

Run tests:

```powershell
pnpm exec hardhat test
```

---

## NPM Deployment (Local)

### Step 1: Install

```cmd
cd 5568-Backend
npm install
```

### Step 2: Start Node

```cmd
npx hardhat node
```

### Step 3: Deploy

```cmd
npx hardhat run scripts/deploy.ts --network localhost
```

### Step 4: Connect Remix (Optional)

> Skip for CLI-only.

1. Open https://remix.ethereum.org
2. Deploy & Run → Environment: Custom - HttpProvider
3. URL: `http://127.0.0.1:8545`
4. Select contract → At Address → Enter deployed address
