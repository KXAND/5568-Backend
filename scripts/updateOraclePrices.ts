import hre from "hardhat";
import { deploy } from "./deploy.js";

interface TokenPrice {
  name: string;
  coingeckoId: string;
}

interface TokenWithAddress extends TokenPrice {
  address: `0x${string}`;
}

// 价格来源配置（地址来自 deploy.ts）
const TOKENS: Record<"ALC" | "BOB", TokenPrice> = {
  ALC: {
    name: "ALC",
    coingeckoId: "usd-coin",
  },
  BOB: {
    name: "BOB",
    coingeckoId: "ethereum",
  },
};

/**
 * 从CoinGecko API获取代币价格
 * @param coingeckoId CoinGecko代币ID
 * @returns 以USD表示的价格
 */
async function getPriceFromCoinGecko(coingeckoId: string): Promise<number> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
    );
    const data = (await response.json()) as Record<string, Record<string, number>>;
    const price = data[coingeckoId]?.usd;
    if (!price) {
      throw new Error(`无法获取 ${coingeckoId} 的价格`);
    }
    return price;
  } catch (error) {
    console.error(`获取 ${coingeckoId} 价格失败:`, error);
    throw error;
  }
}

/**
 * 将价格转换为1e18标度
 * @param price USD价格
 * @returns 缩放后的价格
 */
function scalePrice(price: number): bigint {
  // 价格缩放到1e18，例如: $1 => 1e18, $3000 => 3000e18
  const scaledPrice = price * 1e18;
  return BigInt(Math.floor(scaledPrice));
}

/**
 * 主函数：获取价格并写入Oracle
 */
async function updateOraclePrices() {
  console.log("开始更新Oracle价格...\n");

  try {
    const { viem } = await hre.network.connect({ network: "localhost" });
    const publicClient = await viem.getPublicClient();
    const [deployer] = await viem.getWalletClients();

    // 使用 deploy.ts 的返回地址，避免手工维护地址
    const deployed = await deploy({ viem });
    const oracle = await viem.getContractAt("SimpleOracle", deployed.oracle);

    const tokensWithAddress: TokenWithAddress[] = [
      { ...TOKENS.ALC, address: deployed.aliceToken },
      { ...TOKENS.BOB, address: deployed.bobToken },
    ];

    console.log(`✓ 连接账户: ${deployer.account.address}`);
    console.log(`✓ Oracle地址: ${deployed.oracle}`);
    console.log(`✓ AliceToken地址: ${deployed.aliceToken}`);
    console.log(`✓ BobToken地址: ${deployed.bobToken}\n`);

    // 更新每个代币的价格
    for (const tokenInfo of tokensWithAddress) {
      console.log(`📝 更新 ${tokenInfo.name}...`);

      try {
        // 获取价格
        const priceUsd = await getPriceFromCoinGecko(tokenInfo.coingeckoId);
        console.log(`  - USD价格: $${priceUsd}`);

        // 缩放价格
        const scaledPrice = scalePrice(priceUsd);
        console.log(`  - 缩放价格 (1e18): ${scaledPrice}`);

        // 写入Oracle
        const tx = await oracle.write.setPrice([tokenInfo.address, scaledPrice], {
          account: deployer.account.address,
        });
        console.log(`  ✓ 交易已提交: ${tx}`);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("  ✓ 交易已确认");
        console.log();
      } catch (error) {
        console.error(`  ✗ 失败: ${error}\n`);
      }
    }

    console.log("✅ Oracle价格更新完成！");
  } catch (error) {
    console.error("❌ 更新失败:", error);
    process.exit(1);
  }
}

// 运行脚本
updateOraclePrices();
