// 自动更新Oracle价格的脚本
// 需要先部署合约并获取地址

import { network } from "hardhat";
import { readFileSync } from "fs";

// 从文件读取合约地址
function readContractAddresses() {
  try {
    const fileContent = readFileSync("contracts.addr", "utf8");
    const addresses = {};
    
    fileContent.split('\n').forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          addresses[key.trim()] = value.trim();
        }
      }
    });
    
    return addresses;
  } catch (error) {
    console.error('读取合约地址文件失败:', error.message);
    console.log('请先运行部署脚本');
    return null;
  }
}

// 价格获取函数
async function getEthPrice() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error('获取ETH价格失败，使用默认价格:', error.message);
    return type(uint256).max;
  }
}

async function getUsdcPrice() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDCUSDT');
    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error('获取USDC价格失败，使用默认价格:', error.message);
    return type(uint256).max;
  }
}

// 主函数
async function main() {
  
  // 1. 读取合约地址
  const addresses = readContractAddresses();
  if (!addresses) {
    return;
  }
  
  const oracleAddress = addresses.ORACLE_ADDRESS;
  const aliceTokenAddress = addresses.ALICE_TOKEN_ADDRESS;
  const bobTokenAddress = addresses.BOB_TOKEN_ADDRESS;
  const deployerAddress = addresses.DEPLOYER_ADDRESS;
  
  // 2. 获取当前价格
  const [ethPrice, usdcPrice] = await Promise.all([
    getEthPrice(),
    getUsdcPrice()
  ]);
  
  console.log(`ETH价格: $${ethPrice.toFixed(2)}`);
  console.log(`USDC价格: $${usdcPrice.toFixed(6)}\n`);
  
  // 3. 连接到网络
  const networkName = process.env.SCRIPT_NETWORK || "localhost";
  
  const { viem } = await network.connect({ network: networkName });
  
  const oracle = await viem.getContractAt("SimpleOracle", oracleAddress);
  
  // 4. 转换价格为合约格式（乘以10^18）
  const ethPriceInWei = BigInt(Math.floor(ethPrice * 1e18));
  const usdcPriceInWei = BigInt(Math.floor(usdcPrice * 1e18));
  
  // 5. 更新Oracle价格（现在只有owner可以调用）
  
  try {
    // 检查调用者是否是owner
    const owner = await oracle.read.owner();
    
    // 获取当前钱包客户端
    const [walletClient] = await viem.getWalletClients();
    const callerAddress = walletClient.account.address;
    
    if (callerAddress.toLowerCase() !== owner.toLowerCase()) {
      console.error('错误: 只有合约所有者可以更新价格');
      console.log(`提示: 请使用部署者账户 (${owner}) 来调用`);
      return;
    }
    
    // 使用批量更新
    const txHash = await oracle.write.setPrices([
      [aliceTokenAddress, bobTokenAddress],
      [ethPriceInWei, usdcPriceInWei]
    ], {
      client: { wallet: walletClient }
    });
    
    // 等待交易确认
    const publicClient = await viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    
    // 验证价格已更新
    const updatedEthPrice = await oracle.read.getPrice([aliceTokenAddress]);
    const updatedUsdcPrice = await oracle.read.getPrice([bobTokenAddress]);
    
    console.log('更新后的价格:');
    console.log(`  ALC(ETH): $${(Number(updatedEthPrice) / 1e18).toFixed(2)}`);
    console.log(`  BOB(USDC): $${(Number(updatedUsdcPrice) / 1e18).toFixed(6)}`);
    
  } catch (error) {
    console.error('更新价格失败:', error.message);
  }  
}

// 运行脚本
main().catch((error) => {
  console.error(' 脚本执行失败:', error);
  process.exit(1);
});