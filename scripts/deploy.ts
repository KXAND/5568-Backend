import { fileURLToPath } from "node:url";
import { network } from "hardhat";

const LIBRARIES = {
  reserve: "project/contracts/logic/ReserveLogic.sol:ReserveLogic",
  debtVault: "project/contracts/logic/DebtVaultLogic.sol:DebtVaultLogic",
  config: "project/contracts/logic/ConfigLogic.sol:ConfigLogic",
  supply: "project/contracts/logic/DepositLogic.sol:DepositLogic",
  borrow: "project/contracts/logic/BorrowLogic.sol:BorrowLogic",
} as const;

export async function deploy() {
  const { viem } = await network.connect({ network: "localhost" });
  const [deployer] = await viem.getWalletClients();

  const reserveLogic = await viem.deployContract("ReserveLogic", [], {
    client: { wallet: deployer },
  });

  const debtVaultLogic = await viem.deployContract("DebtVaultLogic", [], {
    client: { wallet: deployer },
    libraries: {
      [LIBRARIES.reserve]: reserveLogic.address,
    },
  });

  const configLogic = await viem.deployContract("ConfigLogic", [], {
    client: { wallet: deployer },
  });

  const depositLogic = await viem.deployContract("DepositLogic", [], {
    client: { wallet: deployer },
    libraries: {
      [LIBRARIES.reserve]: reserveLogic.address,
    },
  });

  const borrowLogic = await viem.deployContract("BorrowLogic", [], {
    client: { wallet: deployer },
    libraries: {
      [LIBRARIES.reserve]: reserveLogic.address,
    },
  });

  const oracle = await viem.deployContract("SimpleOracle", [], {
    client: { wallet: deployer },
  });

  const baseRate = 0n;
  const slope1 = 5_000_000_000_000_000n;
  const slope2 = 20_000_000_000_000_000n;
  const kink = 800_000_000_000_000_000n;
  const irm = await viem.deployContract(
    "InterestRateModel",
    [baseRate, slope1, slope2, kink],
    { client: { wallet: deployer } }
  );

  const aliceInitial = 1_000_000n * 10n ** 18n;
  const aliceDrip = 100_000n * 10n ** 18n;
  const aliceCooldown = 60n;
  const aliceFaucet = await viem.deployContract(
    "AliceFaucet",
    [aliceInitial, aliceDrip, aliceCooldown],
    { client: { wallet: deployer } }
  );
  const aliceToken = await viem.getContractAt("AliceToken", await aliceFaucet.read.token());

  const bobInitial = 1_000_000n * 10n ** 18n;
  const bobDrip = 100_000n * 10n ** 18n;
  const bobCooldown = 60n;
  const bobFaucet = await viem.deployContract(
    "BobFaucet",
    [bobInitial, bobDrip, bobCooldown],
    { client: { wallet: deployer } }
  );
  const bobToken = await viem.getContractAt("BobToken", await bobFaucet.read.token());

  const pool = await viem.deployContract("LendingPool", [oracle.address], {
    client: { wallet: deployer },
    libraries: {
      [LIBRARIES.reserve]: reserveLogic.address,
      [LIBRARIES.debtVault]: debtVaultLogic.address,
      [LIBRARIES.config]: configLogic.address,
      [LIBRARIES.supply]: depositLogic.address,
      [LIBRARIES.borrow]: borrowLogic.address,
    },
  });

  await pool.write.addReserve(
    [aliceToken.address, irm.address, false, true, 0n, 0n, "Pool Alice", "pALC"],
    { account: deployer.account.address }
  );
  await pool.write.addReserve(
    [bobToken.address, irm.address, true, false, 750_000_000_000_000_000n, 850_000_000_000_000_000n, "Pool Bob", "pBOB"],
    { account: deployer.account.address }
  );

  const flashPool = await viem.deployContract(
    "FlashLoanPool",
    [aliceToken.address, bobToken.address],
    { client: { wallet: deployer } }
  );

  const flashSwap = await viem.deployContract(
    "FlashLoanSwap",
    [aliceToken.address, bobToken.address],
    { client: { wallet: deployer } }
  );

  const flashBot = await viem.deployContract(
    "FlashLoanBot",
    [flashPool.address, pool.address, flashSwap.address],
    { client: { wallet: deployer } }
  );

  const poolCoinTotalSupply = 1_919_810n * 10n ** 18n;
  const poolCoin = await viem.deployContract(
    "PoolCoin",
    [deployer.account.address, poolCoinTotalSupply],
    { client: { wallet: deployer } }
  );

  const poolIncentivesController = await viem.deployContract(
    "PoolIncentivesController",
    [poolCoin.address, pool.address, deployer.account.address],
    { client: { wallet: deployer } }
  );

  await pool.write.setPoolIncentivesController([poolIncentivesController.address], {
    account: deployer.account.address,
  });

  console.log("ReserveLogic:", reserveLogic.address);
  console.log("DebtVaultLogic:", debtVaultLogic.address);
  console.log("ConfigLogic:", configLogic.address);
  console.log("DepositLogic:", depositLogic.address);
  console.log("BorrowLogic:", borrowLogic.address);
  console.log("Oracle:", oracle.address);
  console.log("InterestRateModel:", irm.address);
  console.log("AliceFaucet:", aliceFaucet.address);
  console.log("AliceToken:", aliceToken.address);
  console.log("BobFaucet:", bobFaucet.address);
  console.log("BobToken:", bobToken.address);
  console.log("LendingPool:", pool.address);
  console.log("FlashLoanPool:", flashPool.address);
  console.log("FlashLoanSwap:", flashSwap.address);
  console.log("FlashLoanBot:", flashBot.address);
  console.log("PoolCoin:", poolCoin.address);
  console.log("PoolIncentivesController:", poolIncentivesController.address);

  return {
    reserveLogic: reserveLogic.address,
    debtVaultLogic: debtVaultLogic.address,
    configLogic: configLogic.address,
    depositLogic: depositLogic.address,
    borrowLogic: borrowLogic.address,
    oracle: oracle.address,
    interestRateModel: irm.address,
    aliceFaucet: aliceFaucet.address,
    aliceToken: aliceToken.address,
    bobFaucet: bobFaucet.address,
    bobToken: bobToken.address,
    pool: pool.address,
    flashPool: flashPool.address,
    flashSwap: flashSwap.address,
    flashBot: flashBot.address,
    poolCoin: poolCoin.address,
    poolIncentivesController: poolIncentivesController.address,
  } as const;
}

async function main() {
  await deploy();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
