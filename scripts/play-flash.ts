import { network } from "hardhat";
import { deploy } from "./deploy-flash.js";

async function main() {
  const { viem } = await network.connect({ network: "localhost" });
  const publicClient = await viem.getPublicClient();
  const [A, B] = await viem.getWalletClients();
  const a = A.account.address;
  const b = B.account.address;

  // 正确解构所有地址 - 按 deploy() 返回的顺序
  const [
    ORACLE,
    IRM,
    ALICE_FAUCET,
    ALICE_TOKEN,
    BOB_FAUCET,
    BOB_TOKEN,
    POOL,
    FLASH_POOL,
    TEST_BOT,
    SWAP
  ] = await deploy();

  console.log("Addresses:");
  console.log("ALICE_TOKEN:", ALICE_TOKEN);
  console.log("BOB_TOKEN:", BOB_TOKEN);
  console.log("FLASH_POOL:", FLASH_POOL);
  console.log("TEST_BOT:", TEST_BOT);
  console.log("SWAP:", SWAP);

  // Get contract instances
  const oracle = await viem.getContractAt("SimpleOracle", ORACLE);
  const aliceFaucet = await viem.getContractAt("AliceFaucet", ALICE_FAUCET);
  const bobFaucet = await viem.getContractAt("BobFaucet", BOB_FAUCET);
  const pool = await viem.getContractAt("LendingPool", POOL);
  const flashPool = await viem.getContractAt("FlashLoanPool", FLASH_POOL);
  const testBot = await viem.getContractAt("FlashLoanBot", TEST_BOT);
  const swap = await viem.getContractAt("FlashLoanSwap", SWAP);

  const aliceToken = await viem.getContractAt("AliceToken", ALICE_TOKEN);
  const bobToken = await viem.getContractAt("BobToken", BOB_TOKEN);

  // ========== Part 1: Lending Pool Setup ==========

  // Set oracle prices
  console.log("\n💰 Setting oracle prices...");
  await oracle.write.setPrice([bobToken.address, 1n * 10n ** 18n], { account: a });
  await oracle.write.setPrice([aliceToken.address, 1n * 10n ** 18n], { account: a });
  console.log("  BOB price: $1.00");
  console.log("  ALC price: $1.00");

  // ========== Part 2: Flash Loan Setup ==========

  // User A claims tokens for flash pool
  console.log("\n💰 User A claiming tokens for flash pool...");
  
  // Claim ALC
  let tx = await aliceFaucet.write.claim({ account: a });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  
  
  // Claim BOB
  tx = await bobFaucet.write.claim({ account: a });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  
  const aAliceBefore = await aliceToken.read.balanceOf([a]);
  const aBobBefore = await bobToken.read.balanceOf([a]);
  console.log("  User A ALC:", (Number(aAliceBefore) / 1e18).toFixed(2));
  console.log("  User A BOB:", (Number(aBobBefore) / 1e18).toFixed(2));

  // User A deposits liquidity to FlashLoanPool
  console.log("\n💧 Depositing liquidity to FlashLoanPool...");
  const flashDepositAmount = 1_000n * 10n ** 18n;
  
  // Approve
  console.log("  Approving ALC...");
  let approveTx = await aliceToken.write.approve([FLASH_POOL, flashDepositAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  
  console.log("  Approving BOB...");
  approveTx = await bobToken.write.approve([FLASH_POOL, flashDepositAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  
  // Deposit
  console.log("  Depositing ALC...");
  let depositTx = await flashPool.write.deposit([ALICE_TOKEN, flashDepositAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: depositTx });
  
  console.log("  Depositing BOB...");
  depositTx = await flashPool.write.deposit([BOB_TOKEN, flashDepositAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: depositTx });
  
  const poolAlice = await flashPool.read.getBalance([ALICE_TOKEN]);
  const poolBob = await flashPool.read.getBalance([BOB_TOKEN]);
  console.log("  FlashPool ALC:", (Number(poolAlice) / 1e18).toFixed(2));
  console.log("  FlashPool BOB:", (Number(poolBob) / 1e18).toFixed(2));

  // User A funds bot with ALC for fees
  console.log("\n🤖 Funding bot with ALC...");
  const botFunding = 10n * 10n ** 18n;
  const transferTx = await aliceToken.write.transfer([TEST_BOT, botFunding], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: transferTx });
  
  const botBalance = await aliceToken.read.balanceOf([TEST_BOT]);
  console.log("  Bot ALC balance:", (Number(botBalance) / 1e18).toFixed(2));

  // ========== Part 3: User B executes flash loan ==========
  console.log("\n" + "=".repeat(60));
  console.log("Part 3: Flash Loan Execution");
  console.log("=".repeat(60));

  // User B claims ALC for gas
  console.log("\n👤 User B claiming ALC for gas...");
  tx = await aliceFaucet.write.claim({ account: b });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  await new Promise(resolve => setTimeout(resolve, 1100));
  tx = await aliceFaucet.write.claim({ account: b });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  
  const bAlice = await aliceToken.read.balanceOf([b]);
  console.log("  User B ALC:", (Number(bAlice) / 1e18).toFixed(2));

  // Execute flash loan
  console.log("\n⚡ Executing flash loan...");
  const flashBorrowAmount = 100n * 10n ** 18n;
  const feeRate = await flashPool.read.feeRate();
  const expectedFee = (flashBorrowAmount * feeRate) / 10000n;
  
  console.log("  Borrow amount:", (Number(flashBorrowAmount) / 1e18).toFixed(2), "ALC");
  console.log("  Expected fee:", (Number(expectedFee) / 1e18).toFixed(6), "ALC");
  console.log("  Fee rate:", Number(feeRate) / 100, "%");
  
  const flashTx = await testBot.write.borrow([ALICE_TOKEN, flashBorrowAmount], { account: b });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: flashTx });
  console.log("  ✅ Flash loan executed successfully");
  
  // 解析事件日志
  console.log("\n📋 Event Logs from FlashLoanBot:");
  
  // 导入parseEventLogs用来解析事件
  const { parseEventLogs } = await import('viem');
  
  // 解析所有Log事件
  const parsedLogs = parseEventLogs({
    abi: testBot.abi,
    logs: receipt.logs.filter(log => log.address.toLowerCase() === TEST_BOT.toLowerCase())
  });
  
  for (const log of parsedLogs) {
    if ('eventName' in log && log.eventName === 'Log') {
      const message = log.args?.message;
      const value = log.args?.value;
      console.log(`  📌 ${message}: ${value}`);
    }
  }

  // ========== Part 4: Swap Test ==========
  console.log("\n" + "=".repeat(60));
  console.log("Part 4: Swap Test");
  console.log("=".repeat(60));

  console.log("\n💧 Adding liquidity to Swap...");
  const swapLiquidityAmount = 1_000n * 10n ** 18n;
  
  // Approve tokens for swap
  let swapApproveTx = await aliceToken.write.approve([SWAP, swapLiquidityAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: swapApproveTx });
  
  swapApproveTx = await bobToken.write.approve([SWAP, swapLiquidityAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: swapApproveTx });
  
  // Add liquidity
  let addLiqTx = await swap.write.addLiquidity([ALICE_TOKEN, swapLiquidityAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: addLiqTx });
  
  addLiqTx = await swap.write.addLiquidity([BOB_TOKEN, swapLiquidityAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: addLiqTx });
  
  console.log("  ✅ Liquidity added");
  
  // Test swap: Alice -> Bob
  console.log("\n🔄 Testing Swap: Alice -> Bob");
  const swapAmount = 100n * 10n ** 18n;
  
  // User B claims some Bob tokens first
  tx = await bobFaucet.write.claim({ account: b });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  
  const bBobBefore = await bobToken.read.balanceOf([b]);
  console.log("  User B BOB before swap:", (Number(bBobBefore) / 1e18).toFixed(2));
  
  // User B gets some ALC to swap
  const bAliceBeforeSwap = await aliceToken.read.balanceOf([b]);
  console.log("  User B ALC before swap:", (Number(bAliceBeforeSwap) / 1e18).toFixed(2));
  
  // Get expected output
  const expectedBob = await swap.read.getAliceToBobAmount([swapAmount]);
  console.log("  Swap amount: 100.00 ALC -> ", (Number(expectedBob) / 1e18).toFixed(2), "BOB");
  
  // Approve ALC for swap
  let swapUserApproveTx = await aliceToken.write.approve([SWAP, swapAmount], { account: b });
  await publicClient.waitForTransactionReceipt({ hash: swapUserApproveTx });
  
  // Execute swap
  const swapTx = await swap.write.swapAliceToBob([swapAmount], { account: b });
  await publicClient.waitForTransactionReceipt({ hash: swapTx });
  
  const bBobAfter = await bobToken.read.balanceOf([b]);
  const bAliceAfter = await aliceToken.read.balanceOf([b]);
  console.log("  ✅ Swap executed");
  console.log("    User B ALC after swap:", (Number(bAliceAfter) / 1e18).toFixed(2));
  console.log("    User B BOB after swap:", (Number(bBobAfter) / 1e18).toFixed(2));
  
  const swapPoolStatus = await swap.read.getPoolStatus();
  console.log("\n📊 Swap Pool Status:");
  console.log("  Pool ALC:", (Number(swapPoolStatus[0]) / 1e18).toFixed(2));
  console.log("  Pool BOB:", (Number(swapPoolStatus[1]) / 1e18).toFixed(2));

  // ========== Part 5: Final State ==========
  console.log("\n" + "=".repeat(60));
  console.log("Part 5: Final State");
  console.log("=".repeat(60));

  const finalPoolAlice = await flashPool.read.getBalance([ALICE_TOKEN]);
  const feeEarned = finalPoolAlice - poolAlice;
  console.log("\n📊 FlashPool State:");
  console.log("  FlashPool ALC:", (Number(finalPoolAlice) / 1e18).toFixed(2));
  console.log("  Fee earned:", (Number(feeEarned) / 1e18).toFixed(6), "ALC");
  
  const finalBotBalance2 = await aliceToken.read.balanceOf([TEST_BOT]);
  console.log("  Bot ALC:", (Number(finalBotBalance2) / 1e18).toFixed(2));
  
  const finalBAlice = await aliceToken.read.balanceOf([b]);
  console.log("  User B ALC:", (Number(finalBAlice) / 1e18).toFixed(2));
  
  const finalAAlice2 = await aliceToken.read.balanceOf([a]);
  console.log("  User A ALC:", (Number(finalAAlice2) / 1e18).toFixed(2));

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ ALL TESTS PASSED!");
  console.log("=".repeat(60));
  console.log("\n📈 Summary:");
  console.log("  • Flash Pool: User A deposited", (Number(flashDepositAmount) / 1e18).toFixed(0), "ALC and BOB");
  console.log("  • User B borrowed", (Number(flashBorrowAmount) / 1e18).toFixed(0), "ALC via flash loan");
  console.log("  • FlashPool earned", (Number(feeEarned) / 1e18).toFixed(6), "ALC fee");

  await publicClient.getBlockNumber();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});