import { network } from "hardhat";

export async function deploy() {
  const { viem } = await network.connect({ network: "localhost" });
  const [deployer] = await viem.getWalletClients();

  // 1) Oracle
  const oracle = await viem.deployContract("SimpleOracle", [], {
    client: { wallet: deployer },
  });

  // 2) Interest rate model (kinked)
  const baseRate = 0n;
  const slope1 = 5_000_000_000_000_000n;
  const slope2 = 20_000_000_000_000_000n;
  const kink = 800_000_000_000_000_000n;
  const irm = await viem.deployContract(
    "InterestRateModel",
    [baseRate, slope1, slope2, kink],
    { client: { wallet: deployer } }
  );

  // 3) Faucets + tokens
  const aliceInitial = 1_000_000n * 10n ** 18n;
  const aliceDrip = 100_000n * 10n ** 18n;
  const aliceCooldown = 1n; // 1秒方便测试
  const aliceFaucet = await viem.deployContract(
    "AliceFaucet",
    [aliceInitial, aliceDrip, aliceCooldown],
    { client: { wallet: deployer } }
  );
  const aliceToken = await viem.getContractAt(
    "AliceToken",
    await aliceFaucet.read.token()
  );

  const bobInitial = 1_000_000n * 10n ** 18n;
  const bobDrip = 100_000n * 10n ** 18n;
  const bobCooldown = 1n;
  const bobFaucet = await viem.deployContract(
    "BobFaucet",
    [bobInitial, bobDrip, bobCooldown],
    { client: { wallet: deployer } }
  );
  const bobToken = await viem.getContractAt(
    "BobToken",
    await bobFaucet.read.token()
  );

  // 4) Lending pool
  const ltv = 750_000_000_000_000_000n;
  const pool = await viem.deployContract(
    "LendingPool",
    [
      bobToken.address,
      aliceToken.address,
      oracle.address,
      irm.address,
      ltv,
      "PoolCoin",
      "pCOIN",
    ],
    { client: { wallet: deployer } }
  );

  // 5) FlashLoanPool
  const flashPool = await viem.deployContract(
    "FlashLoanPool",
    [aliceToken.address, bobToken.address],
    { client: { wallet: deployer } }
  );

  // 6) FlashLoanBot
  const testBot = await viem.deployContract(
    "FlashLoanBot",
    [flashPool.address, pool.address],
    { client: { wallet: deployer } }
  );

  // 7) FlashLoanSwap
  const swap = await viem.deployContract(
    "FlashLoanSwap",
    [aliceToken.address, bobToken.address],
    { client: { wallet: deployer } }
  );

  // 8) LiquidationBot
  const liquidationBot = await viem.deployContract(
    "LiquidationBot",
    [flashPool.address, pool.address, aliceToken.address, bobToken.address, swap.address],
    { client: { wallet: deployer } }
  );

  console.log("Oracle:", oracle.address);
  console.log("InterestRateModel:", irm.address);
  console.log("AliceFaucet:", aliceFaucet.address);
  console.log("AliceToken:", aliceToken.address);
  console.log("BobFaucet:", bobFaucet.address);
  console.log("BobToken:", bobToken.address);
  console.log("LendingPool:", pool.address);
  console.log("FlashLoanPool:", flashPool.address);
  console.log("FlashLoanBot:", testBot.address);
  console.log("FlashLoanSwap:", swap.address);
  console.log("LiquidationBot:", liquidationBot.address);

  // 返回所有地址
  return [
    oracle.address,
    irm.address,
    aliceFaucet.address,
    aliceToken.address,
    bobFaucet.address,
    bobToken.address,
    pool.address,
    flashPool.address,
    testBot.address,
    swap.address,
    liquidationBot.address
  ];
}