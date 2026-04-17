export async function runSetupDemo(params: {
  publicClient: any;
  oracle: any;
  aliceFaucet: any;
  bobFaucet: any;
  aliceToken: any;
  bobToken: any;
  pool: any;
  flashPool: any;
  flashSwap: any;
  ownerAddress: `0x${string}`;
  borrowerAddresses: `0x${string}`[];
  one: bigint;
  healthyBobPrice: bigint;
  formatToken: (amount: bigint) => string;
  waitForReceipt: (publicClient: any, hash: `0x${string}`) => Promise<void>;
  setPrices: (
    oracle: any,
    aliceToken: any,
    bobToken: any,
    account: `0x${string}`,
    publicClient: any,
    bobPrice: bigint
  ) => Promise<void>;
}) {
  const {
    publicClient,
    oracle,
    aliceFaucet,
    bobFaucet,
    aliceToken,
    bobToken,
    pool,
    flashPool,
    flashSwap,
    ownerAddress,
    borrowerAddresses,
    healthyBobPrice,
    one,
    formatToken,
    waitForReceipt,
    setPrices,
  } = params;

  await setPrices(oracle, aliceToken, bobToken, ownerAddress, publicClient, healthyBobPrice);

  await waitForReceipt(publicClient, await aliceFaucet.write.claim({ account: ownerAddress }));
  await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: ownerAddress }));
  for (const borrowerAddress of borrowerAddresses) {
    await waitForReceipt(publicClient, await bobFaucet.write.claim({ account: borrowerAddress }));
  }

  const reserveLiquidity = 5_000n * one;
  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([pool.address, reserveLiquidity], { account: ownerAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.deposit([aliceToken.address, reserveLiquidity], { account: ownerAddress })
  );
  console.log("Reserve liquidity funded:", formatToken(reserveLiquidity), "ALC");

  const flashLiquidity = 1_000n * one;
  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([flashPool.address, flashLiquidity], { account: ownerAddress })
  );
  await waitForReceipt(
    publicClient,
    await flashPool.write.deposit([aliceToken.address, flashLiquidity], { account: ownerAddress })
  );
  console.log("Flash pool funded:", formatToken(flashLiquidity), "ALC");

  const swapLiquidity = 1_000n * one;
  await waitForReceipt(
    publicClient,
    await aliceToken.write.approve([flashSwap.address, swapLiquidity], { account: ownerAddress })
  );
  await waitForReceipt(
    publicClient,
    await bobToken.write.approve([flashSwap.address, swapLiquidity], { account: ownerAddress })
  );
  await waitForReceipt(
    publicClient,
    await flashSwap.write.addLiquidity([aliceToken.address, swapLiquidity], { account: ownerAddress })
  );
  await waitForReceipt(
    publicClient,
    await flashSwap.write.addLiquidity([bobToken.address, swapLiquidity], { account: ownerAddress })
  );
  console.log("Swap liquidity funded:", formatToken(swapLiquidity), "ALC and BOB");
}
