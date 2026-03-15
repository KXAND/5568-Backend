// scripts/deploy.ts
import { network } from "hardhat";

export async function deploy() {
  const { viem } = await network.connect({ network: "localhost" });
  const [deployer] = await viem.getWalletClients();

  // 1) Oracle
  const oracle = await viem.deployContract("SimpleOracle", [], {
    client: { wallet: deployer },
  });

  // 2) Interest rate model (kinked)
  // Rates are per-block, scaled by 1e18
  const baseRate = 0n;
  const slope1 = 5_000_000_000_000_000n; // 0.005
  const slope2 = 20_000_000_000_000_000n; // 0.02
  const kink = 800_000_000_000_000_000n; // 0.8
  const irm = await viem.deployContract(
    "InterestRateModel",
    [baseRate, slope1, slope2, kink],
    { client: { wallet: deployer } }
  );

  // 3) Faucets + tokens
  const aliceInitial = 1_000_000n * 10n ** 18n;
  const aliceDrip = 100_000n * 10n ** 18n;
  const aliceCooldown = 60n;
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
  const bobCooldown = 60n;
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
  const ltv = 750_000_000_000_000_000n; // 0.75
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

  console.log("Oracle:", oracle.address);
  console.log("InterestRateModel:", irm.address);
  console.log("AliceFaucet:", aliceFaucet.address);
  console.log("AliceToken:", aliceToken.address);
  console.log("BobFaucet:", bobFaucet.address);
  console.log("BobToken:", bobToken.address);
  console.log("LendingPool:", pool.address);

  return [oracle.address, irm.address,
    aliceFaucet.address, aliceToken.address,
    bobFaucet.address, bobToken.address,
    pool.address]
}

// deploy().catch((e) => {
//   console.error(e);
//   process.exit(1);
// });
// deploy()