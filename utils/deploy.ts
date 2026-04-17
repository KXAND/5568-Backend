import { DEPLOY_CONFIG } from "./config.js";

const LIBRARIES = {
  reserve: "project/contracts/logic/ReserveLogic.sol:ReserveLogic",
  debtVault: "project/contracts/logic/DebtVaultLogic.sol:DebtVaultLogic",
  config: "project/contracts/logic/ConfigLogic.sol:ConfigLogic",
  supply: "project/contracts/logic/DepositLogic.sol:DepositLogic",
  borrow: "project/contracts/logic/BorrowLogic.sol:BorrowLogic",
} as const;

type DeployOptions = {
  viem: any;
  log?: boolean;
};

export async function deploy(options: DeployOptions) {
  const { viem, log = false } = options;
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

  const irm = await viem.deployContract(
    "InterestRateModel",
    [
      DEPLOY_CONFIG.interestRateModel.baseRate,
      DEPLOY_CONFIG.interestRateModel.slope1,
      DEPLOY_CONFIG.interestRateModel.slope2,
      DEPLOY_CONFIG.interestRateModel.kink,
    ],
    { client: { wallet: deployer } }
  );

  const aliceFaucet = await viem.deployContract(
    "AliceFaucet",
    [
      DEPLOY_CONFIG.faucets.alice.initialSupply,
      DEPLOY_CONFIG.faucets.alice.dripAmount,
      DEPLOY_CONFIG.faucets.alice.cooldown,
    ],
    { client: { wallet: deployer } }
  );
  const aliceToken = await viem.getContractAt("AliceToken", await aliceFaucet.read.token());

  const bobFaucet = await viem.deployContract(
    "BobFaucet",
    [
      DEPLOY_CONFIG.faucets.bob.initialSupply,
      DEPLOY_CONFIG.faucets.bob.dripAmount,
      DEPLOY_CONFIG.faucets.bob.cooldown,
    ],
    { client: { wallet: deployer } }
  );
  const bobToken = await viem.getContractAt("BobToken", await bobFaucet.read.token());

  const issuer = await viem.deployContract("TokenIssuer", [], {
    client: { wallet: deployer },
  });
  await issuer.write.issueToken(
    [
      DEPLOY_CONFIG.issuedTokens.charlie.name,
      DEPLOY_CONFIG.issuedTokens.charlie.symbol,
      deployer.account.address,
      deployer.account.address,
      DEPLOY_CONFIG.issuedTokens.charlie.initialSupply,
    ],
    { account: deployer.account.address }
  );
  const charlieTokenAddress = await issuer.read.getTokenByName([
    DEPLOY_CONFIG.issuedTokens.charlie.name,
  ]);

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
    [
      aliceToken.address,
      irm.address,
      DEPLOY_CONFIG.reserves.alice.canBeCollateral,
      DEPLOY_CONFIG.reserves.alice.canBeBorrowed,
      DEPLOY_CONFIG.reserves.alice.ltv,
      DEPLOY_CONFIG.reserves.alice.liquidationThreshold,
      DEPLOY_CONFIG.reserves.alice.aTokenName,
      DEPLOY_CONFIG.reserves.alice.aTokenSymbol,
    ],
    { account: deployer.account.address }
  );
  await pool.write.addReserve(
    [
      bobToken.address,
      irm.address,
      DEPLOY_CONFIG.reserves.bob.canBeCollateral,
      DEPLOY_CONFIG.reserves.bob.canBeBorrowed,
      DEPLOY_CONFIG.reserves.bob.ltv,
      DEPLOY_CONFIG.reserves.bob.liquidationThreshold,
      DEPLOY_CONFIG.reserves.bob.aTokenName,
      DEPLOY_CONFIG.reserves.bob.aTokenSymbol,
    ],
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

  const poolCoin = await viem.deployContract(
    "PoolCoin",
    [deployer.account.address, DEPLOY_CONFIG.poolCoin.totalSupply],
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

  const tokensByName = {
    Alice: aliceToken.address,
    Bob: bobToken.address,
    Charlie: charlieTokenAddress,
  } as const;

  if (log) {
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
    console.log("TokenIssuer:", issuer.address);
    console.log("CharlieToken:", charlieTokenAddress);
    console.log("LendingPool:", pool.address);
    console.log("FlashLoanPool:", flashPool.address);
    console.log("FlashLoanSwap:", flashSwap.address);
    console.log("FlashLoanBot:", flashBot.address);
    console.log("PoolCoin:", poolCoin.address);
    console.log("PoolIncentivesController:", poolIncentivesController.address);
  }

  return {
    reserveLogic: reserveLogic.address,
    debtVaultLogic: debtVaultLogic.address,
    configLogic: configLogic.address,
    depositLogic: depositLogic.address,
    borrowLogic: borrowLogic.address,
    oracle: oracle.address,
    interestRateModel: irm.address,
    issuer: issuer.address,
    tokensByName,
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
