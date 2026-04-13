import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEventLogs, parseUnits } from "viem";
import { network } from "hardhat";

import { deploy } from "../../scripts/deploy.js";

type AmountInput = string | number | bigint;
type ReserveConfigInput = {
  canBeCollateral: boolean;
  canBeBorrowed: boolean;
  ltv: AmountInput;
  liquidationThreshold: AmountInput;
};
type MarketSetup = {
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

export type WalletAlias = "A" | "B" | "C" | "D";
export type AssetAlias = "alice" | "bob";
export type TestContext = {
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
export type OpenVaultParams = {
  borrower: WalletAlias;
  collateralAsset: AssetAlias;
  collateralAmount: AmountInput;
  borrowAsset: AssetAlias;
  borrowAmount: AmountInput;
};
export type OpenVaultResult = {
  vaultId: bigint;
  borrower: WalletAlias;
  borrowerAddress: `0x${string}`;
  collateralAsset: AssetAlias;
  borrowAsset: AssetAlias;
  collateralToken: any;
  borrowToken: any;
};
export type VaultState = {
  debt: bigint;
  hf: bigint;
};
export type DirectLiquidationResult = {
  claimableBefore: bigint;
  claimableAfter: bigint;
  seizedShares: bigint;
};
export type FlashLiquidationResult = {
  expectedFee: bigint;
  flashPoolBalanceBefore: bigint;
  flashPoolBalanceAfter: bigint;
  botDebtBefore: bigint;
  botDebtAfter: bigint;
  feeEarned: bigint;
};
export type IncentivesFlowResult = {
  depositBefore: bigint;
  depositAfter: bigint;
  repayBefore: bigint;
  repayAfter: bigint;
  ownerPoolBefore: bigint;
  ownerPoolAfter: bigint;
  borrowerPoolBefore: bigint;
  borrowerPoolAfter: bigint;
};

const ONE = 10n ** 18n;
const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
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

let hardhatNodeProcess: ChildProcess | undefined;
let hardhatNodeUsers = 0;
let hardhatNodeStartedByUs = false;
let hardhatNodeStartup: Promise<void> | undefined;

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function parseAmountOrDefault(value: AmountInput | undefined, fallback: AmountInput) {
  return parseAmount(value ?? fallback);
}

function getAssetContract(asset: AssetAlias, ctx: TestContext) {
  return asset === "alice" ? ctx.aliceToken : ctx.bobToken;
}

async function isLocalNodeReady() {
  try {
    const response = await fetch(LOCAL_RPC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function waitForLocalNodeReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isLocalNodeReady()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Hardhat localhost node did not become ready in time");
}

async function waitForReceipt(publicClient: any, hash: `0x${string}`) {
  await publicClient.waitForTransactionReceipt({ hash });
}

async function increaseTime(publicClient: any, seconds: number) {
  await publicClient.request({ method: "evm_increaseTime", params: [seconds] });
  await publicClient.request({ method: "evm_mine", params: [] });
}

async function createDebtVault(
  pool: any,
  collateralToken: any,
  borrowerAddress: `0x${string}`,
  collateralAmount: bigint,
  borrowAsset: `0x${string}`,
  borrowAmount: bigint,
  publicClient: any
) {
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

export function parseAmount(value: AmountInput) {
  if (typeof value === "bigint") {
    return value;
  }

  const text = String(value).trim();
  if (text.endsWith("wei")) {
    return BigInt(text.slice(0, -3).trim());
  }

  return parseUnits(text, 18);
}

export async function runQuietly<T>(callback: () => Promise<T>) {
  const originalLog = console.log;
  console.log = () => {};

  try {
    return await callback();
  } finally {
    console.log = originalLog;
  }
}

export async function acquireLocalNode() {
  hardhatNodeUsers += 1;

  if (await isLocalNodeReady()) {
    return;
  }

  if (!hardhatNodeStartup) {
    const nextNodeProcess = spawn("pnpm exec hardhat node", {
      cwd: WORKSPACE_ROOT,
      shell: true,
      stdio: "ignore",
    });

    hardhatNodeProcess = nextNodeProcess;
    hardhatNodeStartedByUs = true;
    hardhatNodeStartup = new Promise<void>((resolve, reject) => {
      nextNodeProcess.once("error", reject);
      waitForLocalNodeReady().then(resolve, reject);
    }).catch((error) => {
      nextNodeProcess.kill();
      hardhatNodeProcess = undefined;
      hardhatNodeStartedByUs = false;
      throw error;
    }).finally(() => {
      hardhatNodeStartup = undefined;
    });
  }

  await hardhatNodeStartup;
}

export async function releaseLocalNode() {
  hardhatNodeUsers = Math.max(0, hardhatNodeUsers - 1);

  if (hardhatNodeUsers > 0 || !hardhatNodeStartedByUs || hardhatNodeStartup) {
    return;
  }

  hardhatNodeProcess?.kill();
  hardhatNodeProcess = undefined;
  hardhatNodeStartedByUs = false;
}

export async function createTestContext(): Promise<TestContext> {
  const { viem } = await network.connect({ network: "localhost" });
  const publicClient = await viem.getPublicClient();
  const [A, B, C, D] = await viem.getWalletClients();
  const addresses = {
    A: A.account.address,
    B: B.account.address,
    C: C.account.address,
    D: D.account.address,
  };
  const deployed = await deploy();

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
    wallets: { A, B, C, D },
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
  };
}

export async function setupMarket(ctx: TestContext, config: MarketSetup = {}) {
  const initialAlicePrice = parseAmountOrDefault(config.initialAlicePrice, "1");
  const initialBobPrice = parseAmountOrDefault(config.initialBobPrice, "2");
  const reserveAlice = parseAmountOrDefault(config.reserveAlice, "5000");
  const reserveBob = parseAmountOrDefault(config.reserveBob, "0");
  const flashAlice = parseAmountOrDefault(config.flashAlice, "1000");
  const flashBob = parseAmountOrDefault(config.flashBob, "0");
  const swapAlice = parseAmountOrDefault(config.swapAlice, "1000");
  const swapBob = parseAmountOrDefault(config.swapBob, "1000");
  const swapExchangeRate = config.swapExchangeRate === undefined
    ? undefined
    : parseAmount(config.swapExchangeRate);
  const aliceClaims = config.claimAliceFaucetFor ?? ["A"];
  const bobClaims = config.claimBobFaucetFor ?? ["A", "B", "C", "D"];
  const aliceReserveConfig = config.aliceReserveConfig ?? DEFAULT_ALICE_RESERVE_CONFIG;
  const bobReserveConfig = config.bobReserveConfig ?? DEFAULT_BOB_RESERVE_CONFIG;

  await setPrices(ctx, { alicePrice: initialAlicePrice, bobPrice: initialBobPrice });

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
        parseAmount(aliceReserveConfig.ltv),
        parseAmount(aliceReserveConfig.liquidationThreshold),
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
        parseAmount(bobReserveConfig.ltv),
        parseAmount(bobReserveConfig.liquidationThreshold),
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
}

export async function createAliceBobFixture() {
  const ctx = await createTestContext();
  await setupAliceCollateralBobBorrowMarket(ctx);
  return ctx;
}

export async function createIncentivesFixture() {
  const ctx = await createTestContext();
  await setupIncentivesMarket(ctx);
  return ctx;
}

export async function setupAliceCollateralBobBorrowMarket(ctx: TestContext) {
  await setupMarket(ctx, {
    initialAlicePrice: "100",
    initialBobPrice: "1",
    reserveAlice: "0",
    reserveBob: "5000",
    flashAlice: "0",
    flashBob: "1000",
    swapAlice: "100",
    swapBob: "10000",
    swapExchangeRate: "0.01",
    claimAliceFaucetFor: ["A", "B", "C", "D"],
    claimBobFaucetFor: ["A", "B", "C", "D"],
    aliceReserveConfig: {
      canBeCollateral: true,
      canBeBorrowed: false,
      ltv: "0.75",
      liquidationThreshold: "0.85",
    },
    bobReserveConfig: {
      canBeCollateral: false,
      canBeBorrowed: true,
      ltv: "0",
      liquidationThreshold: "0",
    },
  });
}

export async function setupIncentivesMarket(ctx: TestContext) {
  await setupMarket(ctx, {
    initialAlicePrice: "1",
    initialBobPrice: "2",
    reserveAlice: "5000",
    reserveBob: "0",
    flashAlice: "0",
    flashBob: "0",
    swapAlice: "1",
    swapBob: "1",
    claimAliceFaucetFor: ["A", "B"],
    claimBobFaucetFor: ["A", "B"],
    aliceReserveConfig: {
      canBeCollateral: false,
      canBeBorrowed: true,
      ltv: "0",
      liquidationThreshold: "0",
    },
    bobReserveConfig: {
      canBeCollateral: true,
      canBeBorrowed: false,
      ltv: "0.75",
      liquidationThreshold: "0.85",
    },
  });
}

export async function setPrices(
  ctx: TestContext,
  prices: { alicePrice: AmountInput; bobPrice: AmountInput }
) {
  await waitForReceipt(
    ctx.publicClient,
    await ctx.oracle.write.setPrice([ctx.aliceToken.address, parseAmount(prices.alicePrice)], {
      account: ctx.addresses.A,
    })
  );
  await waitForReceipt(
    ctx.publicClient,
    await ctx.oracle.write.setPrice([ctx.bobToken.address, parseAmount(prices.bobPrice)], {
      account: ctx.addresses.A,
    })
  );
}

export async function openVault(ctx: TestContext, params: OpenVaultParams): Promise<OpenVaultResult> {
  const borrowerAddress = ctx.addresses[params.borrower];
  const collateralToken = getAssetContract(params.collateralAsset, ctx);
  const borrowToken = getAssetContract(params.borrowAsset, ctx);
  const vaultId = await createDebtVault(
    ctx.pool,
    collateralToken,
    borrowerAddress,
    parseAmount(params.collateralAmount),
    borrowToken.address,
    parseAmount(params.borrowAmount),
    ctx.publicClient
  );

  return {
    vaultId,
    borrower: params.borrower,
    borrowerAddress,
    collateralAsset: params.collateralAsset,
    borrowAsset: params.borrowAsset,
    collateralToken,
    borrowToken,
  };
}

export async function readVaultState(
  ctx: TestContext,
  vaultId: bigint,
  debtAsset: AssetAlias
): Promise<VaultState> {
  const debtToken = getAssetContract(debtAsset, ctx);
  const debt = await ctx.pool.read.getDebtVaultDebtAmount([vaultId, debtToken.address]);
  const hf = await ctx.pool.read.healthFactor([vaultId]);

  return { debt, hf };
}

export async function directLiquidate(
  ctx: TestContext,
  params: {
    vaultId: bigint;
    liquidator: WalletAlias;
    borrowAsset: AssetAlias;
    collateralAsset: AssetAlias;
    repayAmount: AmountInput;
  }
): Promise<DirectLiquidationResult> {
  const liquidatorAddress = ctx.addresses[params.liquidator];
  const borrowToken = getAssetContract(params.borrowAsset, ctx);
  const collateralToken = getAssetContract(params.collateralAsset, ctx);
  const repayAmount = parseAmount(params.repayAmount);
  const claimableBefore = await ctx.pool.read.getUserClaimableShares([liquidatorAddress, collateralToken.address]);

  await waitForReceipt(
    ctx.publicClient,
    await borrowToken.write.approve([ctx.pool.address, repayAmount], { account: liquidatorAddress })
  );
  await waitForReceipt(
    ctx.publicClient,
    await ctx.pool.write.liquidate(
      [params.vaultId, borrowToken.address, collateralToken.address, repayAmount],
      { account: liquidatorAddress }
    )
  );

  const claimableAfter = await ctx.pool.read.getUserClaimableShares([liquidatorAddress, collateralToken.address]);

  return {
    claimableBefore,
    claimableAfter,
    seizedShares: BigInt(claimableAfter) - BigInt(claimableBefore),
  };
}

export async function flashLiquidate(
  ctx: TestContext,
  params: {
    vaultId: bigint;
    caller: WalletAlias;
    borrowAsset: AssetAlias;
    collateralAsset: AssetAlias;
    borrowAmount: AmountInput;
    verboseLogs?: boolean;
  }
): Promise<FlashLiquidationResult> {
  const callerAddress = ctx.addresses[params.caller];
  const debtToken = getAssetContract(params.borrowAsset, ctx);
  const collateralToken = getAssetContract(params.collateralAsset, ctx);
  const borrowAmount = parseAmount(params.borrowAmount);
  const feeRate = await ctx.flashPool.read.feeRate();
  const expectedFee = (borrowAmount * feeRate) / 10_000n;
  const flashPoolBalanceBefore = await ctx.flashPool.read.getBalance([debtToken.address]);
  const botDebtBefore = await debtToken.read.balanceOf([ctx.flashBot.address]);

  const flashTx = await ctx.flashBot.write.borrow(
    [debtToken.address, borrowAmount, params.vaultId, collateralToken.address],
    { account: callerAddress }
  );
  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash: flashTx });

  if (params.verboseLogs) {
    parseEventLogs({
      abi: ctx.flashBot.abi,
      logs: receipt.logs.filter(
        (log: { address: string }) => log.address.toLowerCase() === ctx.flashBot.address.toLowerCase()
      ),
      strict: false,
    });
  }

  const flashPoolBalanceAfter = await ctx.flashPool.read.getBalance([debtToken.address]);
  const botDebtAfter = await debtToken.read.balanceOf([ctx.flashBot.address]);

  assertCondition(
    flashPoolBalanceAfter >= flashPoolBalanceBefore + expectedFee,
    "Flash pool did not receive the expected repayment fee"
  );

  return {
    expectedFee,
    flashPoolBalanceBefore,
    flashPoolBalanceAfter,
    botDebtBefore,
    botDebtAfter,
    feeEarned: BigInt(flashPoolBalanceAfter) - BigInt(flashPoolBalanceBefore),
  };
}

export async function recoverViaRepeatedFlashLiquidation(
  ctx: TestContext,
  params: {
    vaultId: bigint;
    caller: WalletAlias;
    borrowAsset: AssetAlias;
    collateralAsset: AssetAlias;
    maxIterations?: number;
    finalHealthFactorTarget?: AmountInput;
  }
) {
  const maxIterations = params.maxIterations ?? 10;
  const finalHealthFactorTarget = parseAmountOrDefault(params.finalHealthFactorTarget, "1");
  let iteration = 0;
  let state = await readVaultState(ctx, params.vaultId, params.borrowAsset);

  assertCondition(state.hf < ONE, "vault is already healthy");

  while (state.hf < finalHealthFactorTarget) {
    iteration += 1;
    const currentDebt = await ctx.pool.read.getDebtVaultDebtAmount([
      params.vaultId,
      getAssetContract(params.borrowAsset, ctx).address,
    ]);

    await flashLiquidate(ctx, {
      vaultId: params.vaultId,
      caller: params.caller,
      borrowAsset: params.borrowAsset,
      collateralAsset: params.collateralAsset,
      borrowAmount: currentDebt,
    });

    state = await readVaultState(ctx, params.vaultId, params.borrowAsset);
    assertCondition(iteration < maxIterations, "exceeded max iterations");
  }

  return {
    iteration,
    state,
  };
}

export async function exitPosition(ctx: TestContext, position: OpenVaultResult) {
  const borrowerCollateralBefore = await position.collateralToken.read.balanceOf([position.borrowerAddress]);
  const debtBeforeExit = await ctx.pool.read.getDebtVaultDebtAmount([position.vaultId, position.borrowToken.address]);
  let remainingDebt = debtBeforeExit;

  for (let repayAttempt = 0; repayAttempt < 3 && remainingDebt > 0n; repayAttempt += 1) {
    const borrowerDebtTokenBalance = await position.borrowToken.read.balanceOf([position.borrowerAddress]);
    assertCondition(
      borrowerDebtTokenBalance > 0n,
      "borrower has no debt-token balance left to close the position"
    );

    await waitForReceipt(
      ctx.publicClient,
      await position.borrowToken.write.approve([ctx.pool.address, borrowerDebtTokenBalance], {
        account: position.borrowerAddress,
      })
    );
    await waitForReceipt(
      ctx.publicClient,
      await ctx.pool.write.repay([position.vaultId, position.borrowToken.address, borrowerDebtTokenBalance], {
        account: position.borrowerAddress,
      })
    );

    remainingDebt = await ctx.pool.read.getDebtVaultDebtAmount([position.vaultId, position.borrowToken.address]);
  }

  const debtAfterRepay = await ctx.pool.read.getDebtVaultDebtAmount([position.vaultId, position.borrowToken.address]);
  const remainingCollateral = await ctx.pool.read.getDebtVaultCollateralAssetAmount([
    position.vaultId,
    position.collateralToken.address,
  ]);

  if (remainingCollateral > 0n) {
    await waitForReceipt(
      ctx.publicClient,
      await ctx.pool.write.withdrawCollateral([position.vaultId, position.collateralToken.address, remainingCollateral], {
        account: position.borrowerAddress,
      })
    );
    await waitForReceipt(
      ctx.publicClient,
      await ctx.pool.write.withdraw([position.collateralToken.address, remainingCollateral], {
        account: position.borrowerAddress,
      })
    );
  }

  const borrowerCollateralAfter = await position.collateralToken.read.balanceOf([position.borrowerAddress]);
  const collateralAfterExit = await ctx.pool.read.getDebtVaultCollateralAssetAmount([
    position.vaultId,
    position.collateralToken.address,
  ]);

  assertCondition(debtAfterRepay === 0n, "remaining debt was not fully cleared");
  assertCondition(
    borrowerCollateralAfter > borrowerCollateralBefore,
    "borrower did not recover collateral balance"
  );
  assertCondition(collateralAfterExit === 0n, "collateral still remains in the vault after exit");
}

export async function runIncentivesRewardFlow(
  ctx: TestContext,
  params: {
    borrower?: WalletAlias;
    healthyBobPrice?: AmountInput;
    collateralAmount?: AmountInput;
    borrowAmount?: AmountInput;
    withdrawAmount?: AmountInput;
    withdrawWaitSeconds?: number;
    repayAmount?: AmountInput;
    repayWaitSeconds?: number;
  } = {}
): Promise<IncentivesFlowResult> {
  const poolCoin = await ctx.viem.getContractAt("PoolCoin", ctx.deployed.poolCoin);
  const incentives = await ctx.viem.getContractAt(
    "PoolIncentivesController",
    ctx.deployed.poolIncentivesController
  );
  const borrower = params.borrower ?? "B";
  const borrowerAddress = ctx.addresses[borrower];
  const healthyBobPrice = parseAmountOrDefault(params.healthyBobPrice, "2");
  const collateralAmount = parseAmountOrDefault(params.collateralAmount, "100");
  const borrowAmount = parseAmountOrDefault(params.borrowAmount, "10");
  const withdrawAmount = parseAmountOrDefault(params.withdrawAmount, "1");
  const withdrawWaitSeconds = params.withdrawWaitSeconds ?? 60;
  const repayAmount = parseAmountOrDefault(params.repayAmount, "1");
  const repayWaitSeconds = params.repayWaitSeconds ?? 60;

  const depositRewardType = await incentives.read.DEPOSIT_REWARD_TYPE();
  const borrowRewardType = await incentives.read.BORROW_REWARD_TYPE();

  await waitForReceipt(
    ctx.publicClient,
    await incentives.write.configureReward([ctx.aliceToken.address, depositRewardType, 10n ** 16n], {
      account: ctx.addresses.A,
    })
  );
  await waitForReceipt(
    ctx.publicClient,
    await incentives.write.configureReward([ctx.aliceToken.address, borrowRewardType, 2n * 10n ** 16n], {
      account: ctx.addresses.A,
    })
  );
  await waitForReceipt(
    ctx.publicClient,
    await poolCoin.write.transfer([incentives.address, 100_000n * ONE], {
      account: ctx.addresses.A,
    })
  );

  const depositBefore = await incentives.read.unclaimedRewards([ctx.addresses.A]);
  await increaseTime(ctx.publicClient, withdrawWaitSeconds);
  await waitForReceipt(
    ctx.publicClient,
    await ctx.pool.write.withdraw([ctx.aliceToken.address, withdrawAmount], {
      account: ctx.addresses.A,
    })
  );
  await increaseTime(ctx.publicClient, withdrawWaitSeconds);
  await waitForReceipt(
    ctx.publicClient,
    await ctx.pool.write.withdraw([ctx.aliceToken.address, withdrawAmount], {
      account: ctx.addresses.A,
    })
  );
  const depositAfter = await incentives.read.unclaimedRewards([ctx.addresses.A]);

  await setPrices(ctx, { alicePrice: "1", bobPrice: healthyBobPrice });
  const position = await openVault(ctx, {
    borrower,
    collateralAsset: "bob",
    collateralAmount,
    borrowAsset: "alice",
    borrowAmount,
  });

  await waitForReceipt(
    ctx.publicClient,
    await ctx.aliceToken.write.approve([ctx.pool.address, 2n * repayAmount], {
      account: borrowerAddress,
    })
  );

  const repayBefore = await incentives.read.unclaimedRewards([borrowerAddress]);
  await increaseTime(ctx.publicClient, repayWaitSeconds);
  await waitForReceipt(
    ctx.publicClient,
    await ctx.pool.write.repay([position.vaultId, ctx.aliceToken.address, repayAmount], {
      account: borrowerAddress,
    })
  );
  await increaseTime(ctx.publicClient, repayWaitSeconds);
  await waitForReceipt(
    ctx.publicClient,
    await ctx.pool.write.repay([position.vaultId, ctx.aliceToken.address, repayAmount], {
      account: borrowerAddress,
    })
  );
  const repayAfter = await incentives.read.unclaimedRewards([borrowerAddress]);

  const ownerPoolBefore = await poolCoin.read.balanceOf([ctx.addresses.A]);
  if (depositAfter > 0n) {
    await waitForReceipt(
      ctx.publicClient,
      await incentives.write.claimRewards([ctx.addresses.A], {
        account: ctx.addresses.A,
      })
    );
  }
  const ownerPoolAfter = await poolCoin.read.balanceOf([ctx.addresses.A]);

  const borrowerPoolBefore = await poolCoin.read.balanceOf([borrowerAddress]);
  if (repayAfter > 0n) {
    await waitForReceipt(
      ctx.publicClient,
      await incentives.write.claimRewards([borrowerAddress], {
        account: borrowerAddress,
      })
    );
  }
  const borrowerPoolAfter = await poolCoin.read.balanceOf([borrowerAddress]);

  return {
    depositBefore,
    depositAfter,
    repayBefore,
    repayAfter,
    ownerPoolBefore,
    ownerPoolAfter,
    borrowerPoolBefore,
    borrowerPoolAfter,
  };
}