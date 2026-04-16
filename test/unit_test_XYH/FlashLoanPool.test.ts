import assert from "node:assert/strict";
import { describe, it, before, afterEach } from "node:test";
import { network, viem } from "hardhat";

describe("FlashLoanPool", async function () {
  const { viem: viemInstance } = await network.connect();
  const [owner, user1, user2] = await viemInstance.getWalletClients();

  let aliceToken: any;
  let bobToken: any;
  let flashPool: any;

  const ONE = 1000n * (10n ** 18n);

  before(async () => {
    // 部署代币
    aliceToken = await viemInstance.deployContract("AliceToken", [owner.account.address], { client: { wallet: owner } });
    bobToken = await viemInstance.deployContract("BobToken", [owner.account.address], { client: { wallet: owner } });

    // 给用户一些代币用于测试 (mint 更多以防前面测试用掉一些)
    await aliceToken.write.mint([user1.account.address, ONE * 100n], { account: owner.account.address });
    await bobToken.write.mint([user1.account.address, ONE * 100n], { account: owner.account.address });

    // 部署 FlashLoanPool
    flashPool = await viemInstance.deployContract("FlashLoanPool", [
      aliceToken.address,
      bobToken.address,
    ], { client: { wallet: owner } });
  });

  it("should have correct fee rate", async function () {
    const feeRate = await flashPool.read.feeRate();
    const FEE_BASE = await flashPool.read.FEE_BASE();
    assert.equal(feeRate, 1n); // 0.01%
    assert.equal(FEE_BASE, 10000n);
  });

  it("should allow deposit", async function () {
    await aliceToken.write.approve([flashPool.address, ONE], { account: user1.account.address });

    const initialBalance = await aliceToken.read.balanceOf([flashPool.address]);

    await flashPool.write.deposit([aliceToken.address, ONE], { account: user1.account.address });

    const finalBalance = await aliceToken.read.balanceOf([flashPool.address]);
    assert.equal(finalBalance, initialBalance + ONE);
  });

  it("should reject invalid token deposit", async function () {
    const fakeToken = "0x1234567890123456789012345678901234567890";
    await assert.rejects(
      flashPool.write.deposit([fakeToken, ONE], { account: user1.account.address })
    );
  });

  it("should reject zero amount deposit", async function () {
    await assert.rejects(
      flashPool.write.deposit([aliceToken.address, 0n], { account: user1.account.address })
    );
  });

  it("should allow owner to withdraw", async function () {
    // 先存款
    await aliceToken.write.approve([flashPool.address, ONE], { account: user1.account.address });
    await flashPool.write.deposit([aliceToken.address, ONE], { account: user1.account.address });

    const poolBalanceBefore = await aliceToken.read.balanceOf([flashPool.address]);
    const ownerBalanceBefore = await aliceToken.read.balanceOf([owner.account.address]);

    // owner 提款
    await flashPool.write.withdraw([aliceToken.address, ONE], { account: owner.account.address });

    const poolBalanceAfter = await aliceToken.read.balanceOf([flashPool.address]);
    const ownerBalanceAfter = await aliceToken.read.balanceOf([owner.account.address]);

    assert.equal(poolBalanceAfter, poolBalanceBefore - ONE);
    assert.equal(ownerBalanceAfter, ownerBalanceBefore + ONE);
  });

  it("should not allow non-owner to withdraw", async function () {
    await assert.rejects(
      flashPool.write.withdraw([aliceToken.address, ONE], { account: user1.account.address })
    );
  });

  it("should reject invalid token withdrawal", async function () {
    const fakeToken = "0x1234567890123456789012345678901234567890";
    await assert.rejects(
      flashPool.write.withdraw([fakeToken, ONE], { account: owner.account.address })
    );
  });

  it("should reject zero amount withdrawal", async function () {
    await assert.rejects(
      flashPool.write.withdraw([aliceToken.address, 0n], { account: owner.account.address })
    );
  });

  it("should reject withdrawal exceeding balance", async function () {
    // 尝试提取超过池子余额的数量
    await assert.rejects(
      flashPool.write.withdraw([aliceToken.address, ONE * 100n], { account: owner.account.address })
    );
  });

  it("should set fee rate", async function () {
    await flashPool.write.setFeeRate([50], { account: owner.account.address }); // 0.5%

    const feeRate = await flashPool.read.feeRate();
    assert.equal(feeRate, 50n);
  });

  it("should reject fee rate too high", async function () {
    await assert.rejects(
      flashPool.write.setFeeRate([501], { account: owner.account.address }) // 超过 5%
    );
  });

  it("should return correct balance", async function () {
    const balance = await flashPool.read.getBalance([aliceToken.address]);
    assert.equal(balance, ONE);
  });

  it("should reject invalid token in getBalance", async function () {
    const fakeToken = "0x1234567890123456789012345678901234567890";
    await assert.rejects(
      flashPool.read.getBalance([fakeToken])
    );
  });
});
