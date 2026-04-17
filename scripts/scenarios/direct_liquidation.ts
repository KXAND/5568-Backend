export async function runDirectLiquidationDemo(params: {
  pool: any;
  oracle: any;
  aliceToken: any;
  bobToken: any;
  borrowerClient: any;
  ownerAddress: `0x${string}`;
  one: bigint;
  directLiquidationBobPrice: bigint;
  publicClient: any;
  assertCondition: (condition: boolean, message: string) => void;
  waitForReceipt: (publicClient: any, hash: `0x${string}`) => Promise<void>;
  setPrices: (
    oracle: any,
    aliceToken: any,
    bobToken: any,
    account: `0x${string}`,
    publicClient: any,
    bobPrice: bigint
  ) => Promise<void>;
  createDebtVault: (
    pool: any,
    bobToken: any,
    borrower: { account: { address: `0x${string}` } },
    collateralAmount: bigint,
    borrowAsset: `0x${string}`,
    borrowAmount: bigint,
    publicClient: any
  ) => Promise<bigint>;
  logVaultState: (
    pool: any,
    debtVaultId: bigint,
    debtAsset: `0x${string}`,
    label: string
  ) => Promise<{ debt: bigint; hf: bigint }>;
}) {
  const {
    pool,
    oracle,
    aliceToken,
    bobToken,
    borrowerClient,
    ownerAddress,
    one,
    directLiquidationBobPrice,
    publicClient,
    assertCondition,
    waitForReceipt,
    setPrices,
    createDebtVault,
    logVaultState,
  } = params;

  const directVaultId = await createDebtVault(
    pool,
    bobToken,
    borrowerClient,
    100n * one,
    aliceToken.address,
    100n * one,
    publicClient
  );
  await logVaultState(pool, directVaultId, aliceToken.address, "Before crash");
  await setPrices(oracle, aliceToken, bobToken, ownerAddress, publicClient, directLiquidationBobPrice);
  const directBefore = await logVaultState(pool, directVaultId, aliceToken.address, "After crash");
  assertCondition(directBefore.hf < one, "Direct liquidation vault is not liquidatable");

  const directRepayAmount = 100n * one;
  const directClaimableBefore = await pool.read.getUserClaimableShares([ownerAddress, bobToken.address]);
  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([pool.address, directRepayAmount], { account: ownerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.liquidate([directVaultId, aliceToken.address, bobToken.address, directRepayAmount], {
      account: ownerAddress,
    })
  );
  const directAfter = await logVaultState(pool, directVaultId, aliceToken.address, "After direct liquidation");
  const directClaimableAfter = await pool.read.getUserClaimableShares([ownerAddress, bobToken.address]);
  const directSeizedShares = directClaimableAfter - directClaimableBefore;
  console.log("Direct liquidator seized shares:", directSeizedShares.toString());
  assertCondition(directAfter.debt < directBefore.debt, "Direct liquidation did not reduce debt");
}
