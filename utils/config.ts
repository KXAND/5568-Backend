export const DEPLOY_CONFIG = {
  interestRateModel: {
    baseRate: 0n,
    slope1: 5_000_000_000_000_000n,
    slope2: 20_000_000_000_000_000n,
    kink: 800_000_000_000_000_000n,
  },
  faucets: {
    alice: {
      initialSupply: 1_000_000n * 10n ** 18n,
      dripAmount: 100_000n * 10n ** 18n,
      cooldown: 60n,
    },
    bob: {
      initialSupply: 1_000_000n * 10n ** 18n,
      dripAmount: 100_000n * 10n ** 18n,
      cooldown: 60n,
    },
  },
  issuedTokens: {
    charlie: {
      name: "Charlie Token",
      symbol: "CHR",
      initialSupply: 1_000_000n * 10n ** 18n,
    },
  },
  reserves: {
    alice: {
      canBeCollateral: false,
      canBeBorrowed: true,
      ltv: 0n,
      liquidationThreshold: 0n,
      aTokenName: "Pool Alice",
      aTokenSymbol: "pALC",
    },
    bob: {
      canBeCollateral: true,
      canBeBorrowed: false,
      ltv: 750_000_000_000_000_000n,
      liquidationThreshold: 850_000_000_000_000_000n,
      aTokenName: "Pool Bob",
      aTokenSymbol: "pBOB",
    },
  },
  poolCoin: {
    totalSupply: 1_919_810n * 10n ** 18n,
  },
} as const;
