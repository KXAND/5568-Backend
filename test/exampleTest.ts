import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { network } from "hardhat";
import { deploy } from "../utils/deploy.js";

const ONE = 10n ** 18n;

async function waitForReceipt(publicClient: any, hash: `0x${string}`) {
  await publicClient.waitForTransactionReceipt({ hash });
}

// 这份 example 的重点是示范如何写好项目集成测试。
//
// 两个最基本的测试概念：
// - describe: 一组相关的测试。用来说明“这一组测试整体在测什么”。
// - it: 一个具体的测试样例（test case）。用来说明“这个样例具体验证什么”。
//
// 这里绝对不能怎么做：
// - 不要把多个不同责任混在一个 it 里。
// - 不要只打印日志、不写断言。测试结果必须由断言决定。
// - 不要把开仓、借款、清算、奖励全部塞进一个 helper，然后让 case 本身失去可读性。
//
// 这里应该怎么做：
// - 一个 it 只表达一个明确责任。
// - 测试里能直接看出准备、执行、断言。
// - helper 函数只负责减少重复，不替代 case 本身。


// 关于 console log
// 你写的是测试，不是演示脚本。测试的目标是让人从 describe / it 名称和断言里知道测了什么，不要用你的console log污染输出。
// console.log 不能代替断言。打印了不算测试，只有断言才算测试。
// 除了明确用于解释测试结构的极少量输出，部署地址、过程细节、临时状态值等都不应该出现在测试运行结果里
// 调试时可以临时写 console.log，但提交前必须删掉。

describe("LendingPool integration examples", async function () {
  // 这里直接使用当前 Hardhat 测试上下文提供的 viem。
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, borrower, liquidator] = await viem.getWalletClients();

  let pool: any;
  let oracle: any;
  let alice: any;
  let bob: any;
  let aliceFaucet: any;
  let bobFaucet: any;

  // 这个 helper 只做一件事：设置 oracle 价格。
  // 价格本身和业务断言强相关，所以测试里保留显式传参，
  // 这样读 case 的人能直接看到关键前置条件。
  async function setPrices(alicePrice: bigint, bobPrice: bigint) {
    await waitForReceipt(
      publicClient,
      await oracle.write.setPrice([alice.address, alicePrice], {
        account: owner.account.address,
      })
    );
    await waitForReceipt(
      publicClient,
      await oracle.write.setPrice([bob.address, bobPrice], {
        account: owner.account.address,
      })
    );
  }

  // 这个 helper 只负责给借贷池补充 ALC 储备，
  // 让后续 borrow ALC 的 case 能成立。
  // 它不负责开仓、借款或断言，避免 helper 侵入 case 语义。
  async function fundAliceReserve(amount: bigint) {
    await waitForReceipt(
      publicClient,
      await aliceFaucet.write.claim({ account: owner.account.address })
    );
    await waitForReceipt(
      publicClient,
      await alice.write.approve([pool.address, amount], {
        account: owner.account.address,
      })
    );
    await waitForReceipt(
      publicClient,
      await pool.write.deposit([alice.address, amount], {
        account: owner.account.address,
      })
    );
  }

  beforeEach(async () => {
    // 每个 case 都重新部署一套干净环境。
    // 这样单个测试失败时更容易定位，也不会被前一个 case 污染状态。
    // deploy 直接调用 /scripts/deploy中写好的代码，不要随便拷贝复制，不利于维护
    const deployed = await deploy({ viem });

    pool = await viem.getContractAt("LendingPool", deployed.pool);
    oracle = await viem.getContractAt("SimpleOracle", deployed.oracle);
    alice = await viem.getContractAt("AliceToken", deployed.aliceToken);
    bob = await viem.getContractAt("BobToken", deployed.bobToken);
    aliceFaucet = await viem.getContractAt("AliceFaucet", deployed.aliceFaucet);
    bobFaucet = await viem.getContractAt("BobFaucet", deployed.bobFaucet);
  });

  // 每个 it 是一个具体的测试场景/测试样例。
  // should deposit collateral and withdraw it back 是你期望的结果描述。可以注意到往往是 should ...这个地方必须语义可读
  // 更具体的来说，这个 case 只关心“抵押物能否正确存入和取回”。禁止在这里混入借款、清算等其他业务，保持测试责任单一。
  it("should deposit collateral and withdraw it back", async function () {
    await waitForReceipt(publicClient,
      await bobFaucet.write.claim({ account: borrower.account.address })
    );

    await waitForReceipt(
      publicClient,
      await bob.write.approve([pool.address, 6n * ONE], {
        account: borrower.account.address,
      })
    );
    await waitForReceipt(
      publicClient,
      await pool.write.deposit([bob.address, 6n * ONE], {
        account: borrower.account.address,
      })
    );

    const vaultId = await pool.read.nextDebtVaultId();
    await waitForReceipt(
      publicClient,
      await pool.write.openDebtVault({ account: borrower.account.address })
    );

    await waitForReceipt(
      publicClient,
      await pool.write.depositCollateral([vaultId, bob.address, 6n * ONE], {
        account: borrower.account.address,
      })
    );

    // 调用对应代码，先把 6 BOB 存入 pool，再把这 6 BOB 存进 vault 作为抵押。  
    const afterDeposit = await pool.read.getDebtVaultCollateralAssetAmount([
      vaultId,
      bob.address,
    ]);
    // 这是一个断言，断言关注的是 vault 内部抵押余额。
    // 我们期望用合约中读取的值 afterDeposit 等于正确的存储值 6
    // 如果实际不相等，这个 it 就会 failing
    assert.equal(afterDeposit, 6n * ONE);

    await waitForReceipt(
      publicClient,
      await pool.write.withdrawCollateral([vaultId, bob.address, 6n * ONE], {
        account: borrower.account.address,
      })
    );

    // 完整取回后，vault 内部抵押余额应回到 0。
    const afterWithdraw = await pool.read.getDebtVaultCollateralAssetAmount([
      vaultId,
      bob.address,
    ]);
    assert.equal(afterWithdraw, 0n);// 另一个断言
  });

  // 每个 describe 中通常有多个测试用例。
  it("should open a vault and borrow within a healthy range", async function () {
    // 这个 case 关注“健康借款”：
    // 借款成功，并且借款后 health factor 仍然高于 1。
    // 这里显式设置价格和 reserve，是为了让测试前置条件可读。
    await setPrices(1n * ONE, 2n * ONE);
    await fundAliceReserve(1_000n * ONE);

    await waitForReceipt(
      publicClient,
      await bobFaucet.write.claim({ account: borrower.account.address })
    );
    await waitForReceipt(
      publicClient,
      await bob.write.approve([pool.address, 100n * ONE], {
        account: borrower.account.address,
      })
    );
    await waitForReceipt(
      publicClient,
      await pool.write.deposit([bob.address, 100n * ONE], {
        account: borrower.account.address,
      })
    );

    const vaultId = await pool.read.nextDebtVaultId();
    await waitForReceipt(
      publicClient,
      await pool.write.openDebtVault({ account: borrower.account.address })
    );
    await waitForReceipt(
      publicClient,
      await pool.write.depositCollateral([vaultId, bob.address, 100n * ONE], {
        account: borrower.account.address,
      })
    );
    await waitForReceipt(
      publicClient,
      await pool.write.borrow([vaultId, alice.address, 50n * ONE], {
        account: borrower.account.address,
      })
    );

    // 这里的断言只看最终状态：
    // 债务是否创建成功，健康度是否仍在安全范围内。
    const debt = await pool.read.getDebtVaultDebtAmount([vaultId, alice.address]);
    const healthFactor = await pool.read.healthFactor([vaultId]);

    assert.equal(debt, 50n * ONE);
    assert.ok(healthFactor > ONE, "health factor should stay above 1 after a healthy borrow");
  });

  // 除了正向测试用例 （正确的操作返回正确的结果），也会有负向用例（不正确的操作应该返回错误的结果）
  it("should reject liquidation when the vault is still healthy", async function () {
    // 这个 case 是负向测试：
    // 如果仓位仍然健康，第三方清算应该失败。
    // 负向 case 对协议同样重要，因为它验证“不该发生的事”确实不会发生。
    await setPrices(1n * ONE, 2n * ONE);
    await fundAliceReserve(1_000n * ONE);

    await waitForReceipt(
      publicClient,
      await bobFaucet.write.claim({ account: borrower.account.address })
    );
    await waitForReceipt(
      publicClient,
      await aliceFaucet.write.claim({ account: liquidator.account.address })
    );
    await waitForReceipt(
      publicClient,
      await bob.write.approve([pool.address, 100n * ONE], {
        account: borrower.account.address,
      })
    );
    await waitForReceipt(
      publicClient,
      await pool.write.deposit([bob.address, 100n * ONE], {
        account: borrower.account.address,
      })
    );

    const vaultId = await pool.read.nextDebtVaultId();
    await waitForReceipt(
      publicClient,
      await pool.write.openDebtVault({ account: borrower.account.address })
    );
    await waitForReceipt(
      publicClient,
      await pool.write.depositCollateral([vaultId, bob.address, 100n * ONE], {
        account: borrower.account.address,
      })
    );
    await waitForReceipt(
      publicClient,
      await pool.write.borrow([vaultId, alice.address, 50n * ONE], {
        account: borrower.account.address,
      })
    );
    await waitForReceipt(
      publicClient,
      await alice.write.approve([pool.address, 50n * ONE], {
        account: liquidator.account.address,
      })
    );

    // viem 无法拿到 EVM revert message。只能看到 internal error
    // 所以这里不要匹配具体报错文本，只验证这次调用确实失败。
    await assert.rejects(
      pool.write.liquidate([vaultId, alice.address, bob.address, 50n * ONE], {
        account: liquidator.account.address,
      })
    );
  });
});
/// 测试结构从大到小通常是：文件 -> describe -> it
// 文件用于区分不同模块或不同大流程。
// describe 用于区分同一文件下的不同测试主题。
// it 是一个具体的测试样例，只验证一个明确责任。
//
// 如果还是同一个模块，但测试主题已经不同，这里可以继续往下补新的 describe。
// 如果已经是不同模块，或者不同大流程，应该拆到不同文件里。