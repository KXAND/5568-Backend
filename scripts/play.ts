import { network } from "hardhat";
import { deploy } from "../utils/deploy.js";
import { runDirectLiquidationDemo } from "./scenarios/direct_liquidation.js";
import { runIncentivesDemo } from "./scenarios/incentives.js";
import { runProtocolFeesDemo } from "./scenarios/protocol_fees.js";
import { runRepeatedFlashLiquidationDemo } from "./scenarios/repeated_flash_liquidation.js";
import { runSetupDemo } from "./scenarios/setup.js";
import { runSingleFlashLiquidationDemo } from "./scenarios/single_flash_liquidation.js";

const ONE = 10n ** 18n;
const BOB_PRICE_HEALTHY = 2n * ONE;
const BOB_PRICE_DIRECT_LIQUIDATION = 1n * ONE;
const BOB_PRICE_MULTI_LIQUIDATION = 985_000_000_000_000_000n;
//#region utils
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

async function waitForReceipt(publicClient: any, hash: `0x${string}`) {
  await publicClient.waitForTransactionReceipt({ hash });
}

async function setPrices(
  oracle: any,
  aliceToken: any,
  bobToken: any,
  account: `0x${string}`,
  publicClient: any,
  bobPrice: bigint
) {
  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([aliceToken.address, ONE], { account })
  );
  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([bobToken.address, bobPrice], { account })
  );
}

async function createDebtVault(
  pool: any,
  bobToken: any,
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
    await bobToken.write.approve([pool.address, collateralAmount], { account: borrowerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.deposit([bobToken.address, collateralAmount], { account: borrowerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.depositCollateral([debtVaultId, bobToken.address, collateralAmount], { account: borrowerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.borrow([debtVaultId, borrowAsset, borrowAmount], { account: borrowerAddress })
  );

  return debtVaultId;
}

async function logVaultState(
  pool: any,
  debtVaultId: bigint,
  debtAsset: `0x${string}`,
  label: string
) {
  const debt = await pool.read.getDebtVaultDebtAmount([debtVaultId, debtAsset]);
  const hf = await pool.read.healthFactor([debtVaultId]);
  console.log(label, "debt =", formatToken(debt), "HF =", formatToken(hf));
  return { debt, hf };
}
//#endregion

async function main() {
  const connection: any = await network.connect({ network: "localhost" });
  const { viem } = connection;
  const publicClient = await viem.getPublicClient();
  const [A, B, C, D] = await viem.getWalletClients();
  const a = A.account.address;
  const b = B.account.address;
  const c = C.account.address;
  const d = D.account.address;

  const deployed = await deploy({ viem });

  const oracle = await viem.getContractAt("SimpleOracle", deployed.oracle);
  const aliceFaucet = await viem.getContractAt("AliceFaucet", deployed.aliceFaucet);
  const bobFaucet = await viem.getContractAt("BobFaucet", deployed.bobFaucet);
  const aliceToken = await viem.getContractAt("AliceToken", deployed.aliceToken);
  const bobToken = await viem.getContractAt("BobToken", deployed.bobToken);
  const pool = await viem.getContractAt("LendingPool", deployed.pool);
  const flashPool = await viem.getContractAt("FlashLoanPool", deployed.flashPool);
  const flashSwap = await viem.getContractAt("FlashLoanSwap", deployed.flashSwap);
  const flashBot = await viem.getContractAt("FlashLoanBot", deployed.flashBot);

  printSection("Part 1: Setup Reserves and Flash Contracts");
  await runSetupDemo({
    publicClient,
    oracle,
    aliceFaucet,
    bobFaucet,
    aliceToken,
    bobToken,
    pool,
    flashPool,
    flashSwap,
    ownerAddress: a,
    borrowerAddresses: [b, c, d],
    one: ONE,
    healthyBobPrice: BOB_PRICE_HEALTHY,
    formatToken,
    waitForReceipt,
    setPrices,
  });

  printSection("Part 2: Direct Liquidation");
  await runDirectLiquidationDemo({
    pool,
    oracle,
    aliceToken,
    bobToken,
    borrowerClient: B,
    ownerAddress: a,
    one: ONE,
    directLiquidationBobPrice: BOB_PRICE_DIRECT_LIQUIDATION,
    publicClient,
    assertCondition,
    waitForReceipt,
    setPrices,
    createDebtVault,
    logVaultState,
  });

  printSection("Part 3: Single Flash Loan Liquidation");
  await runSingleFlashLiquidationDemo({
    pool,
    oracle,
    aliceToken,
    bobToken,
    flashPool,
    flashBot,
    borrowerClient: C,
    ownerAddress: a,
    healthyBobPrice: BOB_PRICE_HEALTHY,
    directLiquidationBobPrice: BOB_PRICE_DIRECT_LIQUIDATION,
    one: ONE,
    publicClient,
    formatToken,
    assertCondition,
    setPrices,
    createDebtVault,
    logVaultState,
  });

  printSection("Part 4: Repeated Flash Liquidations Until Healthy");
  await runRepeatedFlashLiquidationDemo({
    pool,
    oracle,
    aliceToken,
    bobToken,
    flashPool,
    flashBot,
    borrowerClient: D,
    ownerAddress: a,
    healthyBobPrice: BOB_PRICE_HEALTHY,
    multiLiquidationBobPrice: BOB_PRICE_MULTI_LIQUIDATION,
    one: ONE,
    publicClient,
    formatToken,
    assertCondition,
    setPrices,
    createDebtVault,
    logVaultState,
  });

  printSection("Part 5: Pool Incentives Demo");
  await runIncentivesDemo({
    viem,
    publicClient,
    deployed,
    pool,
    oracle,
    aliceToken,
    bobToken,
    borrowerClient: B,
    ownerAddress: a,
    one: ONE,
    healthyBobPrice: BOB_PRICE_HEALTHY,
    waitForReceipt,
    setPrices,
    createDebtVault,
  });

  printSection("Part 6: Protocol Fee Demo");
  await runProtocolFeesDemo({
    pool,
    publicClient,
    aliceToken,
    bobToken,
    oracle,
    ownerAddress: a,
    treasuryAddress: b,
    borrowerClient: C,
    one: ONE,
    healthyBobPrice: BOB_PRICE_HEALTHY,
    waitForReceipt,
    setPrices,
    createDebtVault,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
