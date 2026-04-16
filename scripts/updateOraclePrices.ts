import hre from "hardhat";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

interface TokenPrice {
  name: string;
  address: string;
  coingeckoId: string;
  decimals: number;
}

// 配置代币信息
const TOKENS: Record<string, TokenPrice> = {
  USDC: {
    name: "USDC",
    address: "0x0000000000000000000000000000000000000000", // 替换为实际地址
    coingeckoId: "usd-coin",
    decimals: 6,
  },
  ETH: {
    name: "ETH",
    address: "0x0000000000000000000000000000000000000001", // 替换为实际地址
    coingeckoId: "ethereum",
    decimals: 18,
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
 * @param decimals 代币小数位
 * @returns 缩放后的价格
 */
function scalePrice(price: number, decimals: number): bigint {
  // 价格缩放到1e18
  // 例如: $1 USD = 1e18
  // ETH价格在$3000时 = 3000e18
  const scaledPrice = price * Math.pow(10, 18 - decimals);
  return BigInt(Math.floor(scaledPrice));
}

/**
 * 从环境变量读取Oracle地址
 */
function getOracleAddress(): string {
  const oracleAddress = process.env.ORACLE_ADDRESS;
  if (!oracleAddress) {
    throw new Error("请设置 ORACLE_ADDRESS 环境变量");
  }
  return oracleAddress;
}

/**
 * 主函数：获取价格并写入Oracle
 */
async function updateOraclePrices() {
  console.log(" 开始更新Oracle价格...\n");

  try {
    // 连接到网络
    const publicClient = createPublicClient({
      chain: hardhat,
      transport: http("http://127.0.0.1:8545"),
    });

    const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
    if (!privateKey || !privateKey.startsWith("0x")) {
      throw new Error(
        "PRIVATE_KEY environment variable not set or invalid. Set it before running."
      );
    }

    const account = privateKeyToAccount(privateKey);

    const walletClient = createWalletClient({
      account,
      chain: hardhat,
      transport: http("http://127.0.0.1:8545"),
    });

    console.log(`✓ 连接账户: ${account.address}\n`);

    // 获取Oracle合约地址
    const oracleAddress = getOracleAddress();
    console.log(`✓ Oracle地址: ${oracleAddress}\n`);

    // 更新每个代币的价格
    for (const [, tokenInfo] of Object.entries(TOKENS)) {
      console.log(`📝 更新 ${tokenInfo.name}...`);

      try {
        // 获取价格
        const priceUsd = await getPriceFromCoinGecko(tokenInfo.coingeckoId);
        console.log(`  - USD价格: $${priceUsd}`);

        // 缩放价格
        const scaledPrice = scalePrice(priceUsd, tokenInfo.decimals);
        console.log(`  - 缩放价格 (1e18): ${scaledPrice}`);

        // 写入Oracle
        const tx = await walletClient.writeContract({
          address: oracleAddress as `0x${string}`,
          abi: parseAbi([
            "function setPrice(address token, uint256 price) public",
          ]),
          functionName: "setPrice",
          args: [tokenInfo.address as `0x${string}`, BigInt(scaledPrice)],
        });
        console.log(`  ✓ 交易已提交: ${tx}`);
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
