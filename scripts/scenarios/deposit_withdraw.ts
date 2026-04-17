export async function runDepositWithdrawDemo(params: {
  pool: any;
  bobToken: any;
  bobAToken: any;
  userClient: any;
  publicClient: any;
  one: bigint;
  waitForReceipt: (publicClient: any, hash: `0x${string}`) => Promise<void>;
  assertCondition: (condition: boolean, message: string) => void;
}) {
  const { pool, bobToken, bobAToken, userClient, publicClient, one, waitForReceipt, assertCondition } = params;

  const userAddress = userClient.account.address;
  const depositAmount = 6n * one;
  const claimATokenShares = 2n * one;
  const firstWithdrawAmount = 1n * one;
  const collateralAmount = 2n * one;
  const finalWithdrawAmount = 5n * one;

  const lockedBefore = await pool.read.getUserLockedAssetAmount([userAddress, bobToken.address]);
  const claimableBefore = await pool.read.getUserClaimableAssetAmount([userAddress, bobToken.address]);

  await waitForReceipt(
    publicClient,
    await bobToken.write.approve([pool.address, depositAmount], { account: userAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.deposit([bobToken.address, depositAmount], { account: userAddress })
  );

  const claimableAfterDeposit = await pool.read.getUserClaimableAssetAmount([userAddress, bobToken.address]);
  console.log("Deposit 6 BOB -> claimable BOB =", claimableAfterDeposit.toString());
  assertCondition(
    claimableAfterDeposit >= claimableBefore + depositAmount,
    "Deposit did not increase claimable balance"
  );

  await waitForReceipt(
    publicClient,
    await pool.write.claimAToken([bobToken.address, claimATokenShares, userAddress], { account: userAddress })
  );
  const walletATokenAfterClaim = await bobAToken.read.balanceOf([userAddress]);
  const claimableAfterClaimAToken = await pool.read.getUserClaimableShares([userAddress, bobToken.address]);
  console.log("ClaimAToken 2 pBOB -> wallet pBOB =", walletATokenAfterClaim.toString());
  assertCondition(walletATokenAfterClaim >= claimATokenShares, "claimAToken did not move pBOB to wallet");
  assertCondition(
    claimableAfterClaimAToken + claimATokenShares >= depositAmount,
    "claimAToken did not reduce pool claimable shares as expected"
  );

  await waitForReceipt(
    publicClient,
    await bobAToken.write.approve([pool.address, claimATokenShares], { account: userAddress })
  );
  await waitForReceipt(
    publicClient,
    await pool.write.recustodyAToken([bobToken.address, claimATokenShares], { account: userAddress })
  );
  const walletATokenAfterRecustody = await bobAToken.read.balanceOf([userAddress]);
  const claimableAfterRecustody = await pool.read.getUserClaimableAssetAmount([userAddress, bobToken.address]);
  console.log("RecustodyAToken 2 pBOB -> wallet pBOB =", walletATokenAfterRecustody.toString());
  assertCondition(walletATokenAfterRecustody === 0n, "recustodyAToken did not return pBOB to pool custody");
  assertCondition(
    claimableAfterRecustody >= claimableAfterDeposit,
    "recustodyAToken did not restore claimable deposited balance"
  );

  await waitForReceipt(
    publicClient,
    await pool.write.withdraw([bobToken.address, firstWithdrawAmount], { account: userAddress })
  );
  const claimableAfterWithdraw = await pool.read.getUserClaimableAssetAmount([userAddress, bobToken.address]);
  console.log("Withdraw 1 BOB -> claimable BOB =", claimableAfterWithdraw.toString());

  const debtVaultId = await pool.read.nextDebtVaultId();
  await waitForReceipt(publicClient, await pool.write.openDebtVault({ account: userAddress }));
  await waitForReceipt(
    publicClient,
    await pool.write.depositCollateral([debtVaultId, bobToken.address, collateralAmount], { account: userAddress })
  );

  const lockedAfterDepositCollateral = await pool.read.getUserLockedAssetAmount([userAddress, bobToken.address]);
  console.log(
    "DepositCollateral 2 BOB -> locked BOB =",
    lockedAfterDepositCollateral.toString()
  );
  assertCondition(
    lockedAfterDepositCollateral >= lockedBefore + collateralAmount,
    "depositCollateral did not increase locked balance"
  );

  await waitForReceipt(
    publicClient,
    await pool.write.withdrawCollateral([debtVaultId, bobToken.address, collateralAmount], { account: userAddress })
  );

  const lockedAfterWithdrawCollateral = await pool.read.getUserLockedAssetAmount([userAddress, bobToken.address]);
  console.log(
    "WithdrawCollateral 2 BOB -> locked BOB =",
    lockedAfterWithdrawCollateral.toString()
  );
  assertCondition(
    lockedAfterWithdrawCollateral === lockedBefore,
    "withdrawCollateral did not restore locked balance"
  );

  await waitForReceipt(
    publicClient,
    await pool.write.withdraw([bobToken.address, finalWithdrawAmount], { account: userAddress })
  );
  const claimableAfterFinalWithdraw = await pool.read.getUserClaimableAssetAmount([userAddress, bobToken.address]);
  console.log(
    "Withdraw remaining 5 BOB -> final claimable BOB =",
    claimableAfterFinalWithdraw.toString()
  );
  assertCondition(
    claimableAfterFinalWithdraw === claimableBefore,
    "Final withdraw did not restore initial claimable balance"
  );
}
