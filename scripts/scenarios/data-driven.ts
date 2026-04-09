import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEventLogs, parseUnits } from "viem";
import { network } from "hardhat";

import { deploy } from "./deploy.js";
import { runIncentivesDemo } from "./incentives.js";

type AmountInput = string | number;
type WalletAlias = "A" | "B" | "C" | "D";
type AssetAlias = "alice" | "bob";

type ReserveConfigInput = {
  canBeCollateral: boolean;
  canBeBorrowed: boolean;
  ltv: AmountInput;
  liquidationThreshold: AmountInput;
};

type SetupConfig = {
  initialAlicePrice?: AmountInput;
  initialBobPrice?: AmountInput;
  reserveAlice?: AmountInput;
  reserveBob?: AmountInput;
  flashAlice?: AmountInput;
  flashBob?: AmountInput;
  swapAlice?: AmountInput;
  swapBob?: AmountInput;
  swapExchangeRate?: AmountInput;
  claimAliceFaucetFor?: WalletAlias[];
  claimBobFaucetFor?: WalletAlias[];
  aliceReserveConfig?: ReserveConfigInput;
  bobReserveConfig?: ReserveConfigInput;
};

type ScenarioExpect = {
  healthFactorBelow?: AmountInput;
  finalHealthFactorAtLeast?: AmountInput;
  debtReduced?: boolean;
  seizedSharesPositive?: boolean;
  poolFeeEarned?: boolean;
  ownerRewardsIncrease?: boolean;
  borrowerRewardsIncrease?: boolean;
  ownerClaimIncrease?: boolean;
  borrowerClaimIncrease?: boolean;
  remainingDebtCleared?: boolean;
  borrowerRecoveredCollateral?: boolean;
};

type DirectLiquidationScenario = {
  type: "direct-liquidation";
  name: string;
  borrower: WalletAlias;
  liquidator?: WalletAlias;
  collateralAsset?: AssetAlias;
  borrowAsset?: AssetAlias;
  collateralAmount?: AmountInput;
  borrowAmount?: AmountInput;
  collateralBob?: AmountInput;
  borrowAlice?: AmountInput;
  healthyAlicePrice?: AmountInput;
  healthyBobPrice?: AmountInput;
  priceAfter?: AmountInput;
  priceAfterAlice?: AmountInput;
  priceAfterBob?: AmountInput;
  repayAmount?: AmountInput;
  repayAlice?: AmountInput;
  expect?: ScenarioExpect;
};

type BorrowHealthScenario = {
  type: "borrow-health";
  name: string;
  borrower: WalletAlias;
  collateralAsset?: AssetAlias;
  borrowAsset?: AssetAlias;
  collateralAmount?: AmountInput;
  borrowAmount?: AmountInput;
  collateralBob?: AmountInput;
  borrowAlice?: AmountInput;
  healthyAlicePrice?: AmountInput;
  healthyBobPrice?: AmountInput;
  expect?: ScenarioExpect;
};

type FlashLiquidationScenario = {
  type: "flash-liquidation";
  name: string;
  borrower: WalletAlias;
  caller?: WalletAlias;
  collateralAsset?: AssetAlias;
  borrowAsset?: AssetAlias;
  collateralAmount?: AmountInput;
  borrowAmount?: AmountInput;
  collateralBob?: AmountInput;
  borrowAlice?: AmountInput;
  healthyAlicePrice?: AmountInput;
  healthyBobPrice?: AmountInput;
  priceAfter?: AmountInput;
  priceAfterAlice?: AmountInput;
  priceAfterBob?: AmountInput;
  flashBorrowAmount?: AmountInput;
  flashBorrowAlice?: AmountInput;
  verboseLogs?: boolean;
  expect?: ScenarioExpect;
};

type MultiFlashLiquidationScenario = {
  type: "multi-flash-liquidation";
  name: string;
  borrower: WalletAlias;
  caller?: WalletAlias;
  collateralAsset?: AssetAlias;
  borrowAsset?: AssetAlias;
  collateralAmount?: AmountInput;
  borrowAmount?: AmountInput;
  collateralBob?: AmountInput;
  borrowAlice?: AmountInput;
  healthyAlicePrice?: AmountInput;
  healthyBobPrice?: AmountInput;
  priceAfter?: AmountInput;
  priceAfterAlice?: AmountInput;
  priceAfterBob?: AmountInput;
  maxIterations?: number;
  exitPositionAfterRecovery?: boolean;
  expect?: ScenarioExpect;
};

type IncentivesScenario = {
  type: "incentives";
  name: string;
  borrower: WalletAlias;
  collateralBob?: AmountInput;
  borrowAlice?: AmountInput;
  healthyBobPrice?: AmountInput;
  withdrawAmountAlice?: AmountInput;
  withdrawWaitSeconds?: number;
  repayAmountAlice?: AmountInput;
  repayWaitSeconds?: number;
  expect?: ScenarioExpect;
};

type ScenarioConfig = {
  label?: string;
  network?: string;
  setup?: SetupConfig;
  scenarios: Array<
    | BorrowHealthScenario
    | DirectLiquidationScenario
    | FlashLiquidationScenario
    | MultiFlashLiquidationScenario
    | IncentivesScenario
  >;
};

type ScenarioContext = {
  viem: any;
  publicClient: any;
  wallets: Record<WalletAlias, any>;
  addresses: Record<WalletAlias, `0x${string}`>;
  deployed: any;
  oracle: any;
  aliceFaucet: any;
  bobFaucet: any;
  aliceToken: any;
  bobToken: any;
  pool: any;
  flashPool: any;
  flashSwap: any;
  flashBot: any;
};

const ONE = 10n ** 18n;
const DEFAULT_NETWORK = "hardhatMainnet";
const DEFAULT_ALICE_RESERVE_CONFIG: ReserveConfigInput = {
  canBeCollateral: false,
  canBeBorrowed: true,
  ltv: "0",
  liquidationThreshold: "0",
};
const DEFAULT_BOB_RESERVE_CONFIG: ReserveConfigInput = {
  canBeCollateral: true,
  canBeBorrowed: false,
  ltv: "0.75",
  liquidationThreshold: "0.85",
};

function formatToken(amount: bigint) {
  return (Number(amount) / 1e18).toFixed(4);
}

function printSection(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function assertCondition(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseTokenAmount(value: AmountInput | undefined, fallback?: AmountInput) {
  const resolved = value ?? fallback;
  if (resolved === undefined) {
    throw new Error("Missing token amount in scenario file");
  }

  const text = String(resolved).trim();
  if (text.endsWith("wei")) {
    return BigInt(text.slice(0, -3).trim());
  }

  return parseUnits(text, 18);
}

function stripJsonComments(raw: string) {
  let result = "";
  let inString = false;
  let isEscaped = false;
  let index = 0;

  while (index < raw.length) {
    const current = raw[index];
    const next = raw[index + 1];

    if (inString) {
      result += current;
      if (isEscaped) {
        isEscaped = false;
      } else if (current === "\\") {
        isEscaped = true;
      } else if (current === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (current === '"') {
      inString = true;
      result += current;
      index += 1;
      continue;
    }

    if (current === "/" && next === "/") {
      index += 2;
      while (index < raw.length && raw[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      while (index < raw.length && !(raw[index] === "*" && raw[index + 1] === "/")) {
        index += 1;
      }
      index += 2;
      continue;
    }

    result += current;
    index += 1;
  }

  return result;
}

function readScenarioFile(filePath: string) {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(stripJsonComments(raw)) as ScenarioConfig;
}

function getAssetContract(asset: AssetAlias, ctx: ScenarioContext) {
  return asset === "alice" ? ctx.aliceToken : ctx.bobToken;
}

function getAssetAddress(asset: AssetAlias, ctx: ScenarioContext) {
  return getAssetContract(asset, ctx).address as `0x${string}`;
}

function getAssetSymbol(asset: AssetAlias) {
  return asset === "alice" ? "ALC" : "BOB";
}

function resolveCollateralAsset(step: {
  collateralAsset?: AssetAlias;
  collateralAmount?: AmountInput;
  collateralBob?: AmountInput;
}) {
  return step.collateralAsset ?? (step.collateralBob !== undefined ? "bob" : "bob");
}

function resolveBorrowAsset(step: {
  borrowAsset?: AssetAlias;
  borrowAmount?: AmountInput;
  borrowAlice?: AmountInput;
}) {
  return step.borrowAsset ?? (step.borrowAlice !== undefined ? "alice" : "alice");
}

function resolveCollateralAmount(step: { collateralAmount?: AmountInput; collateralBob?: AmountInput }) {
  return parseTokenAmount(step.collateralAmount ?? step.collateralBob);
}

function resolveBorrowAmount(step: { borrowAmount?: AmountInput; borrowAlice?: AmountInput }) {
  return parseTokenAmount(step.borrowAmount ?? step.borrowAlice);
}

function resolveRepayAmount(step: { repayAmount?: AmountInput; repayAlice?: AmountInput }) {
  return parseTokenAmount(step.repayAmount ?? step.repayAlice);
}

function resolveFlashBorrowAmount(step: { flashBorrowAmount?: AmountInput; flashBorrowAlice?: AmountInput }) {
  return parseTokenAmount(step.flashBorrowAmount ?? step.flashBorrowAlice);
}

function resolveHealthyPrices(step: { healthyAlicePrice?: AmountInput; healthyBobPrice?: AmountInput }) {
  return {
    alicePrice: parseTokenAmount(step.healthyAlicePrice, "1"),
    bobPrice: parseTokenAmount(step.healthyBobPrice, "2"),
  };
}

function resolveCrashPrices(
  step: { priceAfter?: AmountInput; priceAfterAlice?: AmountInput; priceAfterBob?: AmountInput },
  currentHealthy: { alicePrice: bigint; bobPrice: bigint }
) {
  return {
    alicePrice: step.priceAfterAlice !== undefined
      ? parseTokenAmount(step.priceAfterAlice)
      : currentHealthy.alicePrice,
    bobPrice: step.priceAfterBob !== undefined
      ? parseTokenAmount(step.priceAfterBob)
      : step.priceAfter !== undefined
        ? parseTokenAmount(step.priceAfter)
        : currentHealthy.bobPrice,
  };
}

function resolveWalletAlias(alias: WalletAlias | undefined, fallback: WalletAlias, ctx: ScenarioContext) {
  return ctx.wallets[alias ?? fallback];
}

async function waitForReceipt(publicClient: any, hash: `0x${string}`) {
  await publicClient.waitForTransactionReceipt({ hash });
}

async function setPrices(
  oracle: any,
  aliceToken: any,
  bobToken: any,
  account: `0x${string}`,
  publicClient: any,
  bobPrice: bigint,
  alicePrice: bigint = ONE
) {
  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([aliceToken.address, alicePrice], { account })
  );
  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([bobToken.address, bobPrice], { account })
  );
}

async function createDebtVault(
  pool: any,
  collateralToken: any,
  borrower: { account: { address: `0x${string}` } },
  collateralAmount: bigint,
  borrowAsset: `0x${string}`,
  borrowAmount: bigint,
  publicClient: any
) {
  const borrowerAddress = borrower.account.address;
  const debtVaultId = await pool.read.nextDebtVaultId();

  await waitForReceipt(publicClient, await pool.write.openDebtVault({ account: borrowerAddress }));
  await waitForReceipt(
    publicClient,
    await collateralToken.write.approve([pool.address, collateralAmount], { account: borrowerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.deposit([collateralToken.address, collateralAmount], { account: borrowerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.depositCollateral([debtVaultId, collateralToken.address, collateralAmount], {
      account: borrowerAddress,
    })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.borrow([debtVaultId, borrowAsset, borrowAmount], { account: borrowerAddress })
  );

  return debtVaultId;
}

async function logVaultState(pool: any, debtVaultId: bigint, debtAsset: `0x${string}`, label: string) {
  const debt = await pool.read.getDebtVaultDebtAmount([debtVaultId, debtAsset]);
  const hf = await pool.read.healthFactor([debtVaultId]);
  console.log(label, "debt =", formatToken(debt), "HF =", formatToken(hf));
  return { debt, hf };
}

async function executeFlashLiquidation(
  flashBot: any,
  flashPool: any,
  flashBotAddress: `0x${string}`,
  debtToken: any,
  collateralToken: any,
  debtVaultId: bigint,
  caller: `0x${string}`,
  publicClient: any,
  borrowAmount: bigint,
  verboseLogs: boolean
) {
  const feeRate = await flashPool.read.feeRate();
  const expectedFee = (borrowAmount * feeRate) / 10_000n;
  const flashPoolBalanceBefore = await flashPool.read.getBalance([debtToken.address]);
  const botDebtBefore = await debtToken.read.balanceOf([flashBotAddress]);

  const flashTx = await flashBot.write.borrow(
    [debtToken.address, borrowAmount, debtVaultId, collateralToken.address],
    { account: caller }
  );
  const receipt = await publicClient.waitForTransactionReceipt({ hash: flashTx });

  if (verboseLogs) {
    const botLogs = parseEventLogs({
      abi: flashBot.abi,
      logs: receipt.logs.filter(
        (log: { address: string }) => log.address.toLowerCase() === flashBot.address.toLowerCase()
      ),
      strict: false,
    });

    console.log("Bot execution logs:");
    for (const log of botLogs) {
      if ("eventName" in log && log.eventName === "Log") {
        const args = log.args as { message: string; value: bigint };
        console.log(" ", args.message + ":", args.value.toString());
      }
    }
  }

  const flashPoolBalanceAfter = await flashPool.read.getBalance([debtToken.address]);
  const botDebtAfter = await debtToken.read.balanceOf([flashBotAddress]);

  assertCondition(
    flashPoolBalanceAfter >= flashPoolBalanceBefore + expectedFee,
    "Flash pool did not receive the expected repayment fee"
  );
  assertCondition(botDebtAfter >= botDebtBefore, "Bot debt-token balance unexpectedly decreased");

  return {
    expectedFee,
    flashPoolBalanceBefore,
    flashPoolBalanceAfter,
    botDebtBefore,
    botDebtAfter,
  };
}

async function buildContext(networkName: string) {
  const { viem } = await network.connect({ network: networkName });
  const publicClient = await viem.getPublicClient();
  const [A, B, C, D] = await viem.getWalletClients();
  const wallets = { A, B, C, D };
  const addresses = {
    A: A.account.address,
    B: B.account.address,
    C: C.account.address,
    D: D.account.address,
  };
  const deployed = await deploy({ network: networkName, viem });

  const oracle = await viem.getContractAt("SimpleOracle", deployed.oracle);
  const aliceFaucet = await viem.getContractAt("AliceFaucet", deployed.aliceFaucet);
  const bobFaucet = await viem.getContractAt("BobFaucet", deployed.bobFaucet);
  const aliceToken = await viem.getContractAt("AliceToken", deployed.aliceToken);
  const bobToken = await viem.getContractAt("BobToken", deployed.bobToken);
  const pool = await viem.getContractAt("LendingPool", deployed.pool);
  const flashPool = await viem.getContractAt("FlashLoanPool", deployed.flashPool);
  const flashSwap = await viem.getContractAt("FlashLoanSwap", deployed.flashSwap);
  const flashBot = await viem.getContractAt("FlashLoanBot", deployed.flashBot);

  return {
    viem,
    publicClient,
    wallets,
    addresses,
    deployed,
    oracle,
    aliceFaucet,
    bobFaucet,
    aliceToken,
    bobToken,
    pool,
    flashPool,
    flashSwap,
    flashBot,
  } satisfies ScenarioContext;
}

async function runSetup(config: SetupConfig | undefined, ctx: ScenarioContext) {
  const initialAlicePrice = parseTokenAmount(config?.initialAlicePrice, "1");
  const initialBobPrice = parseTokenAmount(config?.initialBobPrice, "2");
  const reserveAlice = parseTokenAmount(config?.reserveAlice, "5000");
  const reserveBob = parseTokenAmount(config?.reserveBob, "0");
  const flashAlice = parseTokenAmount(config?.flashAlice, "1000");
  const flashBob = parseTokenAmount(config?.flashBob, "0");
  const swapAlice = parseTokenAmount(config?.swapAlice, "1000");
  const swapBob = parseTokenAmount(config?.swapBob, "1000");
  const swapExchangeRate = config?.swapExchangeRate !== undefined
    ? parseTokenAmount(config.swapExchangeRate)
    : undefined;
  const aliceClaims = config?.claimAliceFaucetFor ?? ["A"];
  const bobClaims = config?.claimBobFaucetFor ?? ["A", "B", "C", "D"];
  const aliceReserveConfig = config?.aliceReserveConfig ?? DEFAULT_ALICE_RESERVE_CONFIG;
  const bobReserveConfig = config?.bobReserveConfig ?? DEFAULT_BOB_RESERVE_CONFIG;

  printSection("Scenario Setup");

  await setPrices(
    ctx.oracle,
    ctx.aliceToken,
    ctx.bobToken,
    ctx.addresses.A,
    ctx.publicClient,
    initialBobPrice,
    initialAlicePrice
  );

  for (const alias of aliceClaims) {
    await waitForReceipt(
      ctx.publicClient,
      await ctx.aliceFaucet.write.claim({ account: ctx.addresses[alias] })
    );
  }

  for (const alias of bobClaims) {
    await waitForReceipt(
      ctx.publicClient,
      await ctx.bobFaucet.write.claim({ account: ctx.addresses[alias] })
    );
  }

  await waitForReceipt(
    ctx.publicClient,
    await ctx.pool.write.setReserveConfig(
      [
        ctx.aliceToken.address,
        aliceReserveConfig.canBeCollateral,
        aliceReserveConfig.canBeBorrowed,
        parseTokenAmount(aliceReserveConfig.ltv),
        parseTokenAmount(aliceReserveConfig.liquidationThreshold),
      ],
      { account: ctx.addresses.A }
    )
  );
  await waitForReceipt(
    ctx.publicClient,
    await ctx.pool.write.setReserveConfig(
      [
        ctx.bobToken.address,
        bobReserveConfig.canBeCollateral,
        bobReserveConfig.canBeBorrowed,
        parseTokenAmount(bobReserveConfig.ltv),
        parseTokenAmount(bobReserveConfig.liquidationThreshold),
      ],
      { account: ctx.addresses.A }
    )
  );

  if (swapExchangeRate !== undefined) {
    await waitForReceipt(
      ctx.publicClient,
      await ctx.flashSwap.write.setExchangeRate([swapExchangeRate], { account: ctx.addresses.A })
    );
  }

  if (reserveAlice > 0n) {
    await waitForReceipt(
      ctx.publicClient,
      await ctx.aliceToken.write.approve([ctx.pool.address, reserveAlice], { account: ctx.addresses.A })
    );
    await waitForReceipt(
      ctx.publicClient,
      await ctx.pool.write.deposit([ctx.aliceToken.address, reserveAlice], { account: ctx.addresses.A })
    );
    console.log("Reserve liquidity funded:", formatToken(reserveAlice), "ALC");
  }

  if (reserveBob > 0n) {
    await waitForReceipt(
      ctx.publicClient,
      await ctx.bobToken.write.approve([ctx.pool.address, reserveBob], { account: ctx.addresses.A })
    );
    await waitForReceipt(
      ctx.publicClient,
      await ctx.pool.write.deposit([ctx.bobToken.address, reserveBob], { account: ctx.addresses.A })
    );
    console.log("Reserve liquidity funded:", formatToken(reserveBob), "BOB");
  }

  if (flashAlice > 0n) {
    await waitForReceipt(
      ctx.publicClient,
      await ctx.aliceToken.write.approve([ctx.flashPool.address, flashAlice], { account: ctx.addresses.A })
    );
    await waitForReceipt(
      ctx.publicClient,
      await ctx.flashPool.write.deposit([ctx.aliceToken.address, flashAlice], { account: ctx.addresses.A })
    );
    console.log("Flash pool funded:", formatToken(flashAlice), "ALC");
  }

  if (flashBob > 0n) {
    await waitForReceipt(
      ctx.publicClient,
      await ctx.bobToken.write.approve([ctx.flashPool.address, flashBob], { account: ctx.addresses.A })
    );
    await waitForReceipt(
      ctx.publicClient,
      await ctx.flashPool.write.deposit([ctx.bobToken.address, flashBob], { account: ctx.addresses.A })
    );
    console.log("Flash pool funded:", formatToken(flashBob), "BOB");
  }

  await waitForReceipt(
    ctx.publicClient,
    await ctx.aliceToken.write.approve([ctx.flashSwap.address, swapAlice], { account: ctx.addresses.A })
  );
  await waitForReceipt(
    ctx.publicClient,
    await ctx.bobToken.write.approve([ctx.flashSwap.address, swapBob], { account: ctx.addresses.A })
  );
  await waitForReceipt(
    ctx.publicClient,
    await ctx.flashSwap.write.addLiquidity([ctx.aliceToken.address, swapAlice], { account: ctx.addresses.A })
  );
  await waitForReceipt(
    ctx.publicClient,
    await ctx.flashSwap.write.addLiquidity([ctx.bobToken.address, swapBob], { account: ctx.addresses.A })
  );
  console.log("Swap liquidity funded:", formatToken(swapAlice), "ALC and", formatToken(swapBob), "BOB");
}

async function runDirectLiquidation(step: DirectLiquidationScenario, ctx: ScenarioContext) {
  printSection(step.name);

  const borrower = resolveWalletAlias(step.borrower, "B", ctx);
  const liquidatorAddress = resolveWalletAlias(step.liquidator, "A", ctx).account.address;
  const collateralAsset = resolveCollateralAsset(step);
  const borrowAsset = resolveBorrowAsset(step);
  const collateralAmount = resolveCollateralAmount(step);
  const borrowAmount = resolveBorrowAmount(step);
  const repayAmount = resolveRepayAmount(step);
  const healthyPrices = resolveHealthyPrices(step);
  const crashPrices = resolveCrashPrices(step, healthyPrices);
  const collateralToken = getAssetContract(collateralAsset, ctx);
  const borrowToken = getAssetContract(borrowAsset, ctx);
  const hfThreshold = parseTokenAmount(step.expect?.healthFactorBelow, "1");

  await setPrices(
    ctx.oracle,
    ctx.aliceToken,
    ctx.bobToken,
    ctx.addresses.A,
    ctx.publicClient,
    healthyPrices.bobPrice,
    healthyPrices.alicePrice
  );
  const vaultId = await createDebtVault(
    ctx.pool,
    collateralToken,
    borrower,
    collateralAmount,
    borrowToken.address,
    borrowAmount,
    ctx.publicClient
  );
  await logVaultState(ctx.pool, vaultId, borrowToken.address, "Before crash");

  await setPrices(
    ctx.oracle,
    ctx.aliceToken,
    ctx.bobToken,
    ctx.addresses.A,
    ctx.publicClient,
    crashPrices.bobPrice,
    crashPrices.alicePrice
  );
  const before = await logVaultState(ctx.pool, vaultId, borrowToken.address, "After crash");
  assertCondition(before.hf < hfThreshold, `${step.name}: health factor did not drop below threshold`);

  const claimableBefore = await ctx.pool.read.getUserClaimableShares([liquidatorAddress, collateralToken.address]);
  await waitForReceipt(
    ctx.publicClient,
    await borrowToken.write.approve([ctx.pool.address, repayAmount], { account: liquidatorAddress })
  );
  await waitForReceipt(
    ctx.publicClient,
    await ctx.pool.write.liquidate([vaultId, borrowToken.address, collateralToken.address, repayAmount], {
      account: liquidatorAddress,
    })
  );

  const after = await logVaultState(ctx.pool, vaultId, borrowToken.address, "After direct liquidation");
  const claimableAfter = await ctx.pool.read.getUserClaimableShares([liquidatorAddress, collateralToken.address]);
  const seizedShares = claimableAfter - claimableBefore;
  console.log("Direct liquidator seized shares:", seizedShares.toString());

  if (step.expect?.debtReduced !== false) {
    assertCondition(after.debt < before.debt, `${step.name}: debt was not reduced`);
  }
  if (step.expect?.seizedSharesPositive !== false) {
    assertCondition(seizedShares > 0n, `${step.name}: no collateral shares were seized`);
  }
}

async function runBorrowHealth(step: BorrowHealthScenario, ctx: ScenarioContext) {
  printSection(step.name);

  const borrower = resolveWalletAlias(step.borrower, "B", ctx);
  const collateralAsset = resolveCollateralAsset(step);
  const borrowAsset = resolveBorrowAsset(step);
  const collateralAmount = resolveCollateralAmount(step);
  const borrowAmount = resolveBorrowAmount(step);
  const healthyPrices = resolveHealthyPrices(step);
  const collateralToken = getAssetContract(collateralAsset, ctx);
  const borrowToken = getAssetContract(borrowAsset, ctx);
  const hfTarget = parseTokenAmount(step.expect?.finalHealthFactorAtLeast, "1");

  await setPrices(
    ctx.oracle,
    ctx.aliceToken,
    ctx.bobToken,
    ctx.addresses.A,
    ctx.publicClient,
    healthyPrices.bobPrice,
    healthyPrices.alicePrice
  );
  const vaultId = await createDebtVault(
    ctx.pool,
    collateralToken,
    borrower,
    collateralAmount,
    borrowToken.address,
    borrowAmount,
    ctx.publicClient
  );

  const state = await logVaultState(ctx.pool, vaultId, borrowToken.address, "Borrowed vault state");
  assertCondition(state.debt > 0n, `${step.name}: vault debt was not created`);
  assertCondition(state.hf >= hfTarget, `${step.name}: health factor is below expected threshold`);
}

async function runFlashLiquidation(step: FlashLiquidationScenario, ctx: ScenarioContext) {
  printSection(step.name);

  const borrower = resolveWalletAlias(step.borrower, "C", ctx);
  const callerAddress = resolveWalletAlias(step.caller, "A", ctx).account.address;
  const collateralAsset = resolveCollateralAsset(step);
  const borrowAsset = resolveBorrowAsset(step);
  const collateralAmount = resolveCollateralAmount(step);
  const borrowAmount = resolveBorrowAmount(step);
  const flashBorrowAmount = resolveFlashBorrowAmount(step);
  const healthyPrices = resolveHealthyPrices(step);
  const crashPrices = resolveCrashPrices(step, healthyPrices);
  const collateralToken = getAssetContract(collateralAsset, ctx);
  const borrowToken = getAssetContract(borrowAsset, ctx);
  const hfThreshold = parseTokenAmount(step.expect?.healthFactorBelow, "1");

  await setPrices(
    ctx.oracle,
    ctx.aliceToken,
    ctx.bobToken,
    ctx.addresses.A,
    ctx.publicClient,
    healthyPrices.bobPrice,
    healthyPrices.alicePrice
  );
  const vaultId = await createDebtVault(
    ctx.pool,
    collateralToken,
    borrower,
    collateralAmount,
    borrowToken.address,
    borrowAmount,
    ctx.publicClient
  );
  await setPrices(
    ctx.oracle,
    ctx.aliceToken,
    ctx.bobToken,
    ctx.addresses.A,
    ctx.publicClient,
    crashPrices.bobPrice,
    crashPrices.alicePrice
  );
  const before = await logVaultState(ctx.pool, vaultId, borrowToken.address, "Before flash liquidation");
  assertCondition(before.hf < hfThreshold, `${step.name}: vault is not liquidatable`);

  const flashResult = await executeFlashLiquidation(
    ctx.flashBot,
    ctx.flashPool,
    ctx.flashBot.address,
    borrowToken,
    collateralToken,
    vaultId,
    callerAddress,
    ctx.publicClient,
    flashBorrowAmount,
    step.verboseLogs ?? false
  );

  const after = await logVaultState(ctx.pool, vaultId, borrowToken.address, "After flash liquidation");
  const feeEarned = BigInt(flashResult.flashPoolBalanceAfter) - BigInt(flashResult.flashPoolBalanceBefore);
  console.log(
    "Flash pool fee earned:",
    formatToken(feeEarned),
    getAssetSymbol(borrowAsset)
  );

  if (step.expect?.debtReduced !== false) {
    assertCondition(after.debt < before.debt, `${step.name}: debt was not reduced`);
  }
  if (step.expect?.poolFeeEarned !== false) {
    assertCondition(
      flashResult.flashPoolBalanceAfter > flashResult.flashPoolBalanceBefore,
      `${step.name}: flash pool did not earn fees`
    );
  }
}

async function runMultiFlashLiquidation(step: MultiFlashLiquidationScenario, ctx: ScenarioContext) {
  printSection(step.name);

  const borrower = resolveWalletAlias(step.borrower, "D", ctx);
  const borrowerAddress = borrower.account.address;
  const callerAddress = resolveWalletAlias(step.caller, "A", ctx).account.address;
  const collateralAsset = resolveCollateralAsset(step);
  const borrowAsset = resolveBorrowAsset(step);
  const collateralAmount = resolveCollateralAmount(step);
  const borrowAmount = resolveBorrowAmount(step);
  const healthyPrices = resolveHealthyPrices(step);
  const crashPrices = resolveCrashPrices(step, healthyPrices);
  const collateralToken = getAssetContract(collateralAsset, ctx);
  const borrowToken = getAssetContract(borrowAsset, ctx);
  const maxIterations = step.maxIterations ?? 10;
  const finalHfTarget = parseTokenAmount(step.expect?.finalHealthFactorAtLeast, "1");

  await setPrices(
    ctx.oracle,
    ctx.aliceToken,
    ctx.bobToken,
    ctx.addresses.A,
    ctx.publicClient,
    healthyPrices.bobPrice,
    healthyPrices.alicePrice
  );
  const vaultId = await createDebtVault(
    ctx.pool,
    collateralToken,
    borrower,
    collateralAmount,
    borrowToken.address,
    borrowAmount,
    ctx.publicClient
  );
  await setPrices(
    ctx.oracle,
    ctx.aliceToken,
    ctx.bobToken,
    ctx.addresses.A,
    ctx.publicClient,
    crashPrices.bobPrice,
    crashPrices.alicePrice
  );

  let iteration = 0;
  let state = await logVaultState(ctx.pool, vaultId, borrowToken.address, "Initial multi-liquidation state");
  assertCondition(state.hf < ONE, `${step.name}: vault is already healthy`);

  while (state.hf < finalHfTarget) {
    iteration += 1;
    const currentDebt = await ctx.pool.read.getDebtVaultDebtAmount([vaultId, borrowToken.address]);
    console.log("Iteration", iteration, "flash borrow amount:", formatToken(currentDebt), getAssetSymbol(borrowAsset));

    await executeFlashLiquidation(
      ctx.flashBot,
      ctx.flashPool,
      ctx.flashBot.address,
      borrowToken,
      collateralToken,
      vaultId,
      callerAddress,
      ctx.publicClient,
      currentDebt,
      false
    );

    state = await logVaultState(
      ctx.pool,
      vaultId,
      borrowToken.address,
      `State after flash liquidation ${iteration}`
    );

    assertCondition(iteration < maxIterations, `${step.name}: exceeded max iterations`);
  }

  console.log("Vault restored healthy after", iteration, "flash liquidations");
  console.log("Final healthy HF:", formatToken(state.hf));

  if (step.exitPositionAfterRecovery) {
    const borrowerCollateralBefore = await collateralToken.read.balanceOf([borrowerAddress]);
    const debtBeforeExit = await ctx.pool.read.getDebtVaultDebtAmount([vaultId, borrowToken.address]);
    let remainingDebt = debtBeforeExit;

    for (let repayAttempt = 0; repayAttempt < 3 && remainingDebt > 0n; repayAttempt += 1) {
      const borrowerDebtTokenBalance = await borrowToken.read.balanceOf([borrowerAddress]);
      assertCondition(
        borrowerDebtTokenBalance > 0n,
        `${step.name}: borrower has no debt-token balance left to close the position`
      );

      await waitForReceipt(
        ctx.publicClient,
        await borrowToken.write.approve([ctx.pool.address, borrowerDebtTokenBalance], { account: borrowerAddress })
      );
      await waitForReceipt(
        ctx.publicClient,
        await ctx.pool.write.repay([vaultId, borrowToken.address, borrowerDebtTokenBalance], {
          account: borrowerAddress,
        })
      );

      remainingDebt = await ctx.pool.read.getDebtVaultDebtAmount([vaultId, borrowToken.address]);
    }

    const debtAfterRepay = await ctx.pool.read.getDebtVaultDebtAmount([vaultId, borrowToken.address]);
    const remainingCollateral = await ctx.pool.read.getDebtVaultCollateralAssetAmount([vaultId, collateralToken.address]);

    if (remainingCollateral > 0n) {
      await waitForReceipt(
        ctx.publicClient,
        await ctx.pool.write.withdrawCollateral([vaultId, collateralToken.address, remainingCollateral], {
          account: borrowerAddress,
        })
      );
      await waitForReceipt(
        ctx.publicClient,
        await ctx.pool.write.withdraw([collateralToken.address, remainingCollateral], { account: borrowerAddress })
      );
    }

    const borrowerCollateralAfter = await collateralToken.read.balanceOf([borrowerAddress]);
    const collateralAfterExit = await ctx.pool.read.getDebtVaultCollateralAssetAmount([vaultId, collateralToken.address]);

    console.log("Borrower repaid remaining debt:", formatToken(debtBeforeExit), getAssetSymbol(borrowAsset));
    console.log("Borrower withdrew remaining collateral:", formatToken(remainingCollateral), getAssetSymbol(collateralAsset));

    if (step.expect?.remainingDebtCleared !== false) {
      assertCondition(debtAfterRepay === 0n, `${step.name}: remaining debt was not fully cleared`);
    }
    if (step.expect?.borrowerRecoveredCollateral !== false) {
      assertCondition(
        borrowerCollateralAfter > borrowerCollateralBefore,
        `${step.name}: borrower did not recover collateral balance`
      );
      assertCondition(
        collateralAfterExit === 0n,
        `${step.name}: collateral still remains in the vault after exit`
      );
    }
  }
}

async function runIncentivesScenario(step: IncentivesScenario, ctx: ScenarioContext) {
  printSection(step.name);

  const borrower = resolveWalletAlias(step.borrower, "B", ctx);
  const result = await runIncentivesDemo({
    viem: ctx.viem,
    publicClient: ctx.publicClient,
    deployed: ctx.deployed,
    pool: ctx.pool,
    oracle: ctx.oracle,
    aliceToken: ctx.aliceToken,
    bobToken: ctx.bobToken,
    borrowerClient: borrower,
    ownerAddress: ctx.addresses.A,
    one: ONE,
    healthyBobPrice: parseTokenAmount(step.healthyBobPrice, "2"),
    waitForReceipt,
    setPrices,
    createDebtVault,
    collateralAmount: parseTokenAmount(step.collateralBob, "100"),
    borrowAmount: parseTokenAmount(step.borrowAlice, "10"),
    withdrawAmount: parseTokenAmount(step.withdrawAmountAlice, "1"),
    withdrawWaitSeconds: step.withdrawWaitSeconds ?? 60,
    repayAmount: parseTokenAmount(step.repayAmountAlice, "1"),
    repayWaitSeconds: step.repayWaitSeconds ?? 60,
  });

  if (step.expect?.ownerRewardsIncrease !== false) {
    assertCondition(result.depositAfter > result.depositBefore, `${step.name}: owner rewards did not increase`);
  }
  if (step.expect?.borrowerRewardsIncrease !== false) {
    assertCondition(result.repayAfter > result.repayBefore, `${step.name}: borrower rewards did not increase`);
  }
  if (step.expect?.ownerClaimIncrease !== false) {
    assertCondition(
      result.ownerPoolAfter > result.ownerPoolBefore,
      `${step.name}: owner reward claim did not increase balance`
    );
  }
  if (step.expect?.borrowerClaimIncrease !== false) {
    assertCondition(
      result.borrowerPoolAfter > result.borrowerPoolBefore,
      `${step.name}: borrower reward claim did not increase balance`
    );
  }
}

export async function runScenarioConfig(config: ScenarioConfig) {
  const networkName = config.network ?? DEFAULT_NETWORK;
  printSection(config.label ?? "Data-driven dynamic test");

  const ctx = await buildContext(networkName);
  await runSetup(config.setup, ctx);

  for (const step of config.scenarios) {
    if (step.type === "borrow-health") {
      await runBorrowHealth(step, ctx);
      continue;
    }
    if (step.type === "direct-liquidation") {
      await runDirectLiquidation(step, ctx);
      continue;
    }
    if (step.type === "flash-liquidation") {
      await runFlashLiquidation(step, ctx);
      continue;
    }
    if (step.type === "multi-flash-liquidation") {
      await runMultiFlashLiquidation(step, ctx);
      continue;
    }
    await runIncentivesScenario(step, ctx);
  }

  printSection("Scenario completed");
  console.log("All configured scenarios passed.");
}

export async function runScenarioFile(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  const config = readScenarioFile(resolvedPath);
  await runScenarioConfig(config);
}