// scripts/deploy.ts
import { network } from "hardhat";
import { writeFileSync } from "fs";

export async function deploy() {
  const { viem } = await network.connect({ network: "localhost" });
  const [deployer] = await viem.getWalletClients();

  console.log("🚀 开始部署完整借贷系统...\n");
  
  // 1) Oracle
  console.log("📝 部署 Oracle 合约...");
  const oracle = await viem.deployContract("SimpleOracle", [], {
    client: { wallet: deployer },
  });
  console.log(`✅ Oracle: ${oracle.address}`);

  // 2) Interest rate model (kinked)
  // Rates are per-block, scaled by 1e18
  const baseRate = 0n;
  const slope1 = 5_000_000_000_000_000n; // 0.005
  const slope2 = 20_000_000_000_000_000n; // 0.02
  const kink = 800_000_000_000_000_000n; // 0.8
  
  console.log("📝 部署 InterestRateModel 合约...");
  const irm = await viem.deployContract(
    "InterestRateModel",
    [baseRate, slope1, slope2, kink],
    { client: { wallet: deployer } }
  );
  console.log(`✅ InterestRateModel: ${irm.address}`);

  // 3) Faucets + tokens
  console.log("📝 部署 AliceFaucet 和 AliceToken...");
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
  console.log(`✅ AliceFaucet: ${aliceFaucet.address}`);
  console.log(`✅ AliceToken: ${aliceToken.address}`);

  console.log("📝 部署 BobFaucet 和 BobToken...");
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
  console.log(`✅ BobFaucet: ${bobFaucet.address}`);
  console.log(`✅ BobToken: ${bobToken.address}`);

  // 4) Lending pool
  console.log("📝 部署 LendingPool...");
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
  console.log(`✅ LendingPool: ${pool.address}`);

  // 保存地址到文件
  const deploymentInfo = {
    network: "localhost",
    timestamp: new Date().toISOString(),
    contracts: {
      oracle: oracle.address,
      interestRateModel: irm.address,
      aliceFaucet: aliceFaucet.address,
      aliceToken: aliceToken.address,
      bobFaucet: bobFaucet.address,
      bobToken: bobToken.address,
      lendingPool: pool.address,
    },
    deployer: deployer.account.address,
  };

  // 保存为 JSON 文件
  writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2));
  
  // 保存为简单的地址文件（便于脚本读取）
  const addressFileContent = `# 合约地址文件
# 生成时间: ${new Date().toISOString()}

ORACLE_ADDRESS=${oracle.address}
INTEREST_RATE_MODEL_ADDRESS=${irm.address}
ALICE_FAUCET_ADDRESS=${aliceFaucet.address}
ALICE_TOKEN_ADDRESS=${aliceToken.address}
BOB_FAUCET_ADDRESS=${bobFaucet.address}
BOB_TOKEN_ADDRESS=${bobToken.address}
LENDING_POOL_ADDRESS=${pool.address}
DEPLOYER_ADDRESS=${deployer.account.address}
`;
  
  writeFileSync("contracts.addr", addressFileContent);
  
  console.log("\n📁 部署信息已保存到以下文件:");
  console.log("   - deployment.json (详细JSON格式)");
  console.log("   - contracts.addr (简单地址格式)\n");
  
  console.log("🎉 完整部署完成!");

  return [oracle.address, irm.address,
    aliceFaucet.address, aliceToken.address,
    bobFaucet.address, bobToken.address,
    pool.address]
}

// 取消注释以下行以启用自动部署
deploy().catch((e) => {
  console.error(e);
  process.exit(1);
});