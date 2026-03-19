// 自动更新Oracle价格的脚本 - 模拟项目版
// 使用: node scripts/updateOracle.js
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
    console.error('❌ 读取合约地址文件失败:', error.message);
    console.log('💡 请先运行部署脚本: npx hardhat run scripts/deploy.ts --network localhost');
    return null;
  }
}

// 价格获取函数 - 使用Binance API（更稳定）
async function getEthPrice() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error('获取ETH价格失败，使用默认价格2000:', error.message);
    return 2000; // 默认价格
  }
}

async function getUsdcPrice() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDCUSDT');
    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error('获取USDC价格失败，使用默认价格1:', error.message);
    return 1; // 默认价格
  }
}

// 主函数
async function main() {
  console.log('🚀 开始更新Oracle价格...\n');
  
  // 1. 读取合约地址
  console.log('📁 读取合约地址文件...');
  const addresses = readContractAddresses();
  if (!addresses) {
    return;
  }
  
  const oracleAddress = addresses.ORACLE_ADDRESS;
  const aliceTokenAddress = addresses.ALICE_TOKEN_ADDRESS;
  const bobTokenAddress = addresses.BOB_TOKEN_ADDRESS;
  
  console.log(`✅ Oracle地址: ${oracleAddress}`);
  console.log(`✅ ALC(ETH)代币地址: ${aliceTokenAddress}`);
  console.log(`✅ BOB(USDC)代币地址: ${bobTokenAddress}\n`);
  
  // 2. 获取当前价格
  console.log('📊 从Binance获取价格数据...');
  const [ethPrice, usdcPrice] = await Promise.all([
    getEthPrice(),
    getUsdcPrice()
  ]);
  
  console.log(`✅ ETH价格: $${ethPrice.toFixed(2)}`);
  console.log(`✅ USDC价格: $${usdcPrice.toFixed(6)}\n`);
  
  // 3. 连接到网络
  const networkName = process.env.SCRIPT_NETWORK || "localhost";
  console.log(`🔗 连接到网络: ${networkName}`);
  
  const { viem } = await network.connect({ network: networkName });
  
  const oracle = await viem.getContractAt("SimpleOracle", oracleAddress);
  
  // 4. 转换价格为合约格式（乘以10^18）
  const ethPriceInWei = BigInt(Math.floor(ethPrice * 1e18));
  const usdcPriceInWei = BigInt(Math.floor(usdcPrice * 1e18));
  
  console.log(`💰 ETH价格(合约格式): ${ethPriceInWei}`);
  console.log(`💰 USDC价格(合约格式): ${usdcPriceInWei}\n`);
  
  // 5. 更新Oracle价格
  console.log('⚡ 正在更新Oracle价格...');
  
  try {
    // 检查公共更新是否启用
    const publicUpdateEnabled = await oracle.read.publicUpdateEnabled();
    console.log(`🔓 公共更新状态: ${publicUpdateEnabled ? '已启用' : '已禁用'}`);
    
    if (!publicUpdateEnabled) {
      console.error('❌ 错误: Oracle公共更新已禁用');
      console.log('💡 提示: 合约默认启用公共更新，如果被禁用需要联系合约所有者');
      return;
    }
    
    // 方法1: 使用批量更新（推荐）
    console.log('🔄 使用批量更新...');
    const txHash = await oracle.write.setPrices([
      [aliceTokenAddress, bobTokenAddress],
      [ethPriceInWei, usdcPriceInWei]
    ]);
    
    console.log(`✅ 交易已发送: ${txHash}`);
    
    // 等待交易确认
    const publicClient = await viem.getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    console.log(`✅ 交易已确认! 区块号: ${receipt.blockNumber}\n`);
    
    // 验证价格已更新
    const updatedEthPrice = await oracle.read.getPrice([aliceTokenAddress]);
    const updatedUsdcPrice = await oracle.read.getPrice([bobTokenAddress]);
    
    console.log('🎯 更新后的价格:');
    console.log(`   ALC(ETH): $${(Number(updatedEthPrice) / 1e18).toFixed(2)}`);
    console.log(`   BOB(USDC): $${(Number(updatedUsdcPrice) / 1e18).toFixed(6)}`);
    
  } catch (error) {
    console.error('❌ 更新价格失败:', error.message);
    console.log('💡 尝试使用单个更新...');
    
    try {
      // 方法2: 分别更新每个价格
      const tx1 = await oracle.write.setPricePublic([aliceTokenAddress, ethPriceInWei]);
      console.log(`✅ ALC价格更新交易: ${tx1}`);
      
      const tx2 = await oracle.write.setPricePublic([bobTokenAddress, usdcPriceInWei]);
      console.log(`✅ BOB价格更新交易: ${tx2}`);
      
      console.log('✅ 价格更新成功!');
    } catch (error2) {
      console.error('❌ 所有更新方法都失败:', error2.message);
      console.log('💡 可能的原因:');
      console.log('   1. 合约地址不正确');
      console.log('   2. 网络连接问题');
      console.log('   3. 账户没有足够的gas');
      console.log('   4. 合约函数调用参数错误');
    }
  }
  
  console.log('\n🎉 Oracle价格更新流程完成!');
}

// 运行脚本
main().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});