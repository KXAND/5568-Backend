import type { WalletClient } from "viem";

type RunProtocolFeesDemoParams = {
  pool: any;
  publicClient: any;
  aliceToken: any;
  bobToken: any;
  oracle: any;
  ownerAddress: `0x${string}`;
  treasuryAddress: `0x${string}`;
  borrowerClient: WalletClient;
  one: bigint;
  healthyBobPrice: bigint;
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
};

async function increaseTime(publicClient: any, seconds: number) {
  await publicClient.request({ method: "evm_increaseTime", params: [seconds] });
  await publicClient.request({ method: "evm_mine", params: [] });
}

export async function runProtocolFeesDemo(params: RunProtocolFeesDemoParams) {
  const {
    pool,
    publicClient,
    aliceToken,
    bobToken,
    oracle,
    ownerAddress,
    treasuryAddress,
    borrowerClient,
    one,
    healthyBobPrice,
    waitForReceipt,
    setPrices,
    createDebtVault,
  } = params;

  const borrowerAddress = borrowerClient.account?.address;
  if (borrowerAddress === undefined) {
    throw new Error("Borrower wallet client has no default account");
  }

  await setPrices(
    oracle,
    aliceToken,
    bobToken,
    ownerAddress,
    publicClient,
    healthyBobPrice
  );

  const reserveFactor = await pool.read.getReserveFactorBps([aliceToken.address]);
  const accruedBefore = await pool.read.getAccruedProtocolFees([aliceToken.address]);
  console.log(
    "Protocol fee config: reserveFactorBps =",
    reserveFactor.toString(),
    "getProtocolLiquidationCutBps =",
    (await pool.read.getProtocolLiquidationCutBps()).toString()
  );

  await createDebtVault(
    pool,
    bobToken,
    { account: { address: borrowerAddress } },
    100n * one,
    aliceToken.address,
    30n * one,
    publicClient
  );

  await increaseTime(publicClient, 3600);
  // Use a full token unit here. Tiny amounts like 1 wei may round to 0 shares when liquidityIndex > 1e18.
  const accrueTriggerDepositAmount = one;
  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([pool.address, accrueTriggerDepositAmount], { account: ownerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.deposit([aliceToken.address, accrueTriggerDepositAmount], { account: ownerAddress })
  );

  const accruedAfter = await pool.read.getAccruedProtocolFees([aliceToken.address]);
  console.log(
    "Interest spread fee accrued (ALC wei): before =",
    accruedBefore.toString(),
    "after =",
    accruedAfter.toString()
  );

  if (accruedAfter > 0n) {
    const collectAmount = accruedAfter < one / 100n ? accruedAfter : one / 100n;
    const ownerAliceBefore = await aliceToken.read.balanceOf([ownerAddress]);
    await waitForReceipt(
      publicClient,
      await pool.write.collectProtocolFees([aliceToken.address, collectAmount, ownerAddress], {
        account: ownerAddress,
      })
    );
    const ownerAliceAfter = await aliceToken.read.balanceOf([ownerAddress]);
    const accruedAfterCollect = await pool.read.getAccruedProtocolFees([aliceToken.address]);
    console.log(
      "Collected protocol fees (ALC wei):",
      collectAmount.toString(),
      "owner balance delta =",
      (ownerAliceAfter - ownerAliceBefore).toString(),
      "remaining accrued =",
      accruedAfterCollect.toString()
    );
  }

  await waitForReceipt(
    publicClient,
    await pool.write.setTreasury([treasuryAddress], { account: ownerAddress })
  );
  const treasurySharesBefore = await pool.read.getUserCustodiedShares([
    treasuryAddress,
    bobToken.address,
  ]);

  const liquidationVaultId = await createDebtVault(
    pool,
    bobToken,
    { account: { address: borrowerAddress } },
    100n * one,
    aliceToken.address,
    60n * one,
    publicClient
  );

  await waitForReceipt(
    publicClient,
    await oracle.write.setPrice([bobToken.address, one / 2n], { account: ownerAddress })
  );

  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([pool.address, 10n * one], { account: ownerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.liquidate(
      [liquidationVaultId, aliceToken.address, bobToken.address, 10n * one],
      { account: ownerAddress }
    )
  );

  const treasurySharesAfter = await pool.read.getUserCustodiedShares([
    treasuryAddress,
    bobToken.address,
  ]);
  console.log(
    "Liquidation cut shares to treasury (BOB shares): delta =",
    (treasurySharesAfter - treasurySharesBefore).toString()
  );

  await waitForReceipt(
    publicClient,
    await pool.write.setTreasury([ownerAddress], { account: ownerAddress })
  );
}
