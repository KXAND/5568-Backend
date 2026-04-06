import { network } from "hardhat";
import { deploy } from "./deploy.js"

async function main() {
  const { viem } = await network.connect({ network: "localhost" });
  const publicClient = await viem.getPublicClient();
  const [A, B, C] = await viem.getWalletClients();
  const a = A.account.address;
  const b = B.account.address;
  const c = C.account.address;

  // Fill these with your deployed addresses
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
  ] = await deploy()

  const oracle = await viem.getContractAt("SimpleOracle", ORACLE);
  const aliceFaucet = await viem.getContractAt("AliceFaucet", ALICE_FAUCET);
  const bobFaucet = await viem.getContractAt("BobFaucet", BOB_FAUCET);
  const pool = await viem.getContractAt("LendingPool", POOL);
  const flashPool = await viem.getContractAt("FlashLoanPool", FLASH_POOL);
  const testBot = await viem.getContractAt("FlashLoanBot", TEST_BOT);
  const swap = await viem.getContractAt("FlashLoanSwap", SWAP);

  const aliceToken = await viem.getContractAt("AliceToken", ALICE_TOKEN);
  const bobToken = await viem.getContractAt("BobToken", BOB_TOKEN);

  // ========== Part 1: Basic Lending Pool Setup (from play.ts) ==========
  console.log("\n" + "=".repeat(60));
  console.log("Part 1: Basic Lending Pool Setup");
  console.log("=".repeat(60));

  // Set oracle prices (1e18 scale)
  await oracle.write.setPrice([bobToken.address, 2n * 10n ** 18n], { account: a });
  await oracle.write.setPrice([aliceToken.address, 1n * 10n ** 18n], { account: a });

  // Claim faucet tokens for A,B; drip: 100_000
  await bobFaucet.write.claim({ account: a });
  await aliceFaucet.write.claim({ account: a });

  // Provide borrow liquidity to pool (A transfers AliceToken to pool)
  const liquidity = 5_000n * 10n ** 18n;
  await aliceToken.write.transfer([pool.address, liquidity], { account: a });

  // Deposit collateral (BobToken)
  const depositAmount = 1_000n * 10n ** 18n;
  await bobToken.write.approve([pool.address, depositAmount], { account: a });
  await pool.write.deposit([depositAmount], { account: a });

  // Borrow AliceToken: 1_000 BOBB = 2000ALC, LTV= 0.75, maxBrw = 1500
  const borrowAmount = 1000n * 10n ** 18n;
  await pool.write.borrow([borrowAmount], { account: a });

  // Repay part of the debt
  const repayAmount = 200n * 10n ** 18n;
  await aliceToken.write.approve([pool.address, repayAmount], { account: a });
  await pool.write.repay([repayAmount], { account: a });

  // Check balances
  const aAlice = await aliceToken.read.balanceOf([a]);
  const aBob = await bobToken.read.balanceOf([a]);
  const hf = await pool.read.healthFactor([a]);

  console.log("A AliceToken:", aAlice.toString());
  console.log("A BobToken:", aBob.toString());
  console.log("HealthFactor:", hf.toString());

  // ========== Part 2: Flash Loan Setup ==========

  // User A claims tokens for flash pool
  console.log("\nUser A claiming tokens for flash pool...");
  
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
  console.log("\nDepositing liquidity to FlashLoanPool...");
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
  console.log("\nFunding bot with ALC...");
  const botFunding = 10n * 10n ** 18n;
  const transferTx = await aliceToken.write.transfer([TEST_BOT, botFunding], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: transferTx });
  
  const botBalance = await aliceToken.read.balanceOf([TEST_BOT]);
  console.log("  Bot ALC balance:", (Number(botBalance) / 1e18).toFixed(2));

  // ========== Part 3: Create Borrower with Debt ==========
  console.log("\n" + "=".repeat(60));
  console.log("Part 3: Create Borrower with Debt");
  console.log("=".repeat(60));

  // Set prices: Bob = $2, Alice = $1 (to create leverage)
  console.log("\nSetting prices for leverage...");
  await oracle.write.setPrice([bobToken.address, 2n * 10n ** 18n], { account: a });
  await oracle.write.setPrice([aliceToken.address, 1n * 10n ** 18n], { account: a });
  console.log("  BOB price: $2.00");
  console.log("  ALC price: $1.00");

  // Fund LendingPool with Alice tokens for borrowing
  console.log("\nFunding LendingPool with borrow tokens...");
  const lendingPoolFundAmount = 300n * 10n ** 18n;
  approveTx = await aliceToken.write.approve([POOL, lendingPoolFundAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  
  tx = await pool.write.fundBorrowToken([lendingPoolFundAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("  LendingPool funded with 300 ALC");

  // User B deposits collateral and borrows
  console.log("\nUser B deposits collateral and borrows...");
  tx = await bobFaucet.write.claim({ account: b });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  
  const collateralAmount = 100n * 10n ** 18n;
  approveTx = await bobToken.write.approve([POOL, collateralAmount], { account: b });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  
  tx = await pool.write.deposit([collateralAmount], { account: b });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("  Deposited 100 BOB as collateral");

  const borrowAmountB = 100n * 10n ** 18n;
  tx = await pool.write.borrow([borrowAmountB], { account: b });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("  Borrowed 100 ALC");

  let accountInfo = await pool.read.getAccountInfo([b]);
  console.log("  Health Factor:", (Number(accountInfo[2]) / 1e18).toFixed(2));

  // ========== Part 4: Price Crash ==========
  console.log("\nPrice crash - BOB price drops to $0.5...");
  await oracle.write.setPrice([bobToken.address, 500_000_000_000_000_000n], { account: a });
  
  accountInfo = await pool.read.getAccountInfo([b]);
  console.log("  New Health Factor:", (Number(accountInfo[2]) / 1e18).toFixed(4));
  console.log("  Position is now liquidatable!");
  console.log("\n" + "=".repeat(60));
  console.log("Part 4: Setup Swap Pool");
  console.log("=".repeat(60));

  // Setup Swap pool with liquidity
  console.log("\n Setting up FlashLoanSwap...");

  // User A adds liquidity to swap
  const swapLiquidityAmount = 500n * 10n ** 18n;
  
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
  
  console.log("   Swap pool funded with 500 ALC and 500 BOB");
  
  console.log("\n" + "=".repeat(60));
  console.log("Part 5: Flash Loan with Liquidation");
  console.log("=".repeat(60));

  // User B claims ALC for gas
  console.log("\nUser B claiming ALC for gas...");
  tx = await aliceFaucet.write.claim({ account: b });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  await new Promise(resolve => setTimeout(resolve, 1100));
  tx = await aliceFaucet.write.claim({ account: b });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  
  const bAlice = await aliceToken.read.balanceOf([b]);
  console.log("  User B ALC:", (Number(bAlice) / 1e18).toFixed(2));

  // Execute flash loan
  console.log("\nExecuting flash loan...");
  const flashBorrowAmount = 100n * 10n ** 18n;
  const feeRate = await flashPool.read.feeRate();
  const expectedFee = (flashBorrowAmount * feeRate) / 10000n;
  
  console.log("  Borrow amount:", (Number(flashBorrowAmount) / 1e18).toFixed(2), "ALC");
  console.log("  Expected fee:", (Number(expectedFee) / 1e18).toFixed(6), "ALC");
  console.log("  Fee rate:", Number(feeRate) / 100, "%");
  
  const flashTx = await testBot.write.borrow([ALICE_TOKEN, flashBorrowAmount, b], { account: b });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: flashTx });
  console.log("   Flash loan executed successfully");
  
  // 解析事件日志
  console.log("\nEvent Logs from FlashLoanBot:");
  
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
      console.log(`  ${message}: ${value}`);
    }
  }

  // ========== Part 6: Direct Liquidation ==========
  console.log("\n" + "=".repeat(60));
  console.log("Part 6: Direct Liquidation");
  console.log("=".repeat(60));

  // Create second borrower (User C) BEFORE further price crash
  console.log("\nUser C (Second Borrower) setup...");

  // Add more funds to LendingPool for second borrower
  console.log("\nAdding more funds to LendingPool for second borrower...");
  const additionalFundAmount = 200n * 10n ** 18n;
  approveTx = await aliceToken.write.approve([POOL, additionalFundAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  
  tx = await pool.write.fundBorrowToken([additionalFundAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("  LendingPool funded with additional 200 ALC");

  // User C claims tokens
  tx = await aliceFaucet.write.claim({ account: c });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  tx = await bobFaucet.write.claim({ account: c });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  // User C deposits collateral and borrows (at $0.5 price)
  const collateralAmount2 = 80n * 10n ** 18n;
  approveTx = await bobToken.write.approve([POOL, collateralAmount2], { account: c });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });

  tx = await pool.write.deposit([collateralAmount2], { account: c });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("  Deposited 80 BOB as collateral");

  const borrowAmount2 = 30n * 10n ** 18n; // Borrow less to maintain healthy position
  tx = await pool.write.borrow([borrowAmount2], { account: c });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("  Borrowed 30 ALC");

  let accountInfo2 = await pool.read.getAccountInfo([c]);
  console.log("  Health Factor at $0.5:", (Number(accountInfo2[2]) / 1e18).toFixed(2));

  // Price crash again - BOB price drops further to $0.3
  console.log("\nFurther price crash - BOB price drops to $0.3...");
  await oracle.write.setPrice([bobToken.address, 300_000_000_000_000_000n], { account: a });

  accountInfo2 = await pool.read.getAccountInfo([c]);
  console.log("  New Health Factor at $0.3:", (Number(accountInfo2[2]) / 1e18).toFixed(4));
  console.log("  Position is now liquidatable!");

  // Execute direct liquidation (not using flash loan)
  console.log("\nExecuting direct liquidation...");

  // User A (liquidator) needs ALC to repay the debt
  const liquidationAmount = 30n * 10n ** 18n; // Full debt amount
  approveTx = await aliceToken.write.approve([POOL, liquidationAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });

  // Direct liquidation call
  const liquidationTx = await pool.write.liquidate([c, liquidationAmount], { account: a });
  await publicClient.waitForTransactionReceipt({ hash: liquidationTx });
  console.log("   Direct liquidation executed successfully");

  // Check liquidator's collateral received
  const liquidatorBobBalance = await bobToken.read.balanceOf([a]);
  console.log("  Liquidator received BOB collateral:", (Number(liquidatorBobBalance) / 1e18).toFixed(2));

  // ========== Part 7: Final State ==========
  console.log("\n" + "=".repeat(60));
  console.log("Part 7: Final State");
  console.log("=".repeat(60));

  const finalPoolAlice = await flashPool.read.getBalance([ALICE_TOKEN]);
  const feeEarned = finalPoolAlice - poolAlice;
  console.log("\n FlashPool State:");
  console.log("  FlashPool ALC:", (Number(finalPoolAlice) / 1e18).toFixed(2));
  console.log("  Fee earned:", (Number(feeEarned) / 1e18).toFixed(6), "ALC");
  
  const finalBotBalance2 = await aliceToken.read.balanceOf([TEST_BOT]);
  console.log("  Bot ALC:", (Number(finalBotBalance2) / 1e18).toFixed(2));
  
  const finalBAlice = await aliceToken.read.balanceOf([b]);
  console.log("  User B ALC:", (Number(finalBAlice) / 1e18).toFixed(2));
  
  const finalCAlice = await aliceToken.read.balanceOf([c]);
  console.log("  User C ALC:", (Number(finalCAlice) / 1e18).toFixed(2));
  
  const finalAAlice2 = await aliceToken.read.balanceOf([a]);
  console.log("  User A ALC:", (Number(finalAAlice2) / 1e18).toFixed(2));

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log(" ALL TESTS PASSED!");
  console.log("=".repeat(60));
  console.log("\n Summary:");
  console.log("  • Flash Pool: User A deposited", (Number(flashDepositAmount) / 1e18).toFixed(0), "ALC and BOB");
  console.log("  • First liquidation: User B liquidated via flash loan (", (Number(flashBorrowAmount) / 1e18).toFixed(0), "ALC)");
  console.log("  • Second liquidation: User C liquidated directly (", (Number(liquidationAmount) / 1e18).toFixed(0), "ALC)");
  console.log("  • FlashPool earned", (Number(feeEarned) / 1e18).toFixed(6), "ALC fee");
  console.log("  • Bot performed 1 flash loan liquidation, 1 direct liquidation");

  await publicClient.getBlockNumber();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});