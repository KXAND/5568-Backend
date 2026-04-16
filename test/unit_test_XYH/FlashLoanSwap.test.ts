import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network, viem } from "hardhat";

describe("FlashLoanSwap", async function () {
  const { viem: viemInstance } = await network.connect();
  const [owner, user1, user2] = await viemInstance.getWalletClients();

  let aliceToken: any;
  let bobToken: any;
  let flashSwap: any;

  const ONE = 1000n * (10n ** 18n);
  const INITIAL_EXCHANGE_RATE = 1500000000000000000n; // 1.5 * 10^18

  before(async () => {
    // 部署代币
    aliceToken = await viemInstance.deployContract("AliceToken", [owner.account.address], { client: { wallet: owner } });
    bobToken = await viemInstance.deployContract("BobToken", [owner.account.address], { client: { wallet: owner } });

    // 给 owner 一些代币用于添加流动性
    await aliceToken.write.mint([owner.account.address, ONE * 10n], { account: owner.account.address });
    await bobToken.write.mint([owner.account.address, ONE * 10n], { account: owner.account.address });

    // 给 user1 一些代币用于 swap 测试
    await aliceToken.write.mint([user1.account.address, ONE * 10n], { account: owner.account.address });
    await bobToken.write.mint([user1.account.address, ONE * 10n], { account: owner.account.address });

    // 部署 FlashLoanSwap
    flashSwap = await viemInstance.deployContract("FlashLoanSwap", [
      aliceToken.address,
      bobToken.address,
    ], { client: { wallet: owner } });

    // 添加流动性
    await aliceToken.write.approve([flashSwap.address, ONE * 10n], { account: owner.account.address });
    await bobToken.write.approve([flashSwap.address, ONE * 10n], { account: owner.account.address });

    await flashSwap.write.addLiquidity([aliceToken.address, ONE * 5n], { account: owner.account.address });
    await flashSwap.write.addLiquidity([bobToken.address, ONE * 5n], { account: owner.account.address });
  });

  it("should have correct initial exchange rate", async function () {
    const rate = await flashSwap.read.exchangeRate();
    assert.equal(rate, INITIAL_EXCHANGE_RATE);
  });

  it("should allow owner to add liquidity", async function () {
    const initialAliceBal = await aliceToken.read.balanceOf([flashSwap.address]);
    const initialBobBal = await bobToken.read.balanceOf([flashSwap.address]);

    await flashSwap.write.addLiquidity([aliceToken.address, ONE], { account: owner.account.address });

    const finalAliceBal = await aliceToken.read.balanceOf([flashSwap.address]);
    assert.equal(finalAliceBal, initialAliceBal + ONE);
  });

  it("should allow owner to remove liquidity", async function () {
    const initialAliceBal = await aliceToken.read.balanceOf([flashSwap.address]);

    await flashSwap.write.removeLiquidity([aliceToken.address, ONE], { account: owner.account.address });

    const finalAliceBal = await aliceToken.read.balanceOf([flashSwap.address]);
    assert.equal(finalAliceBal, initialAliceBal - ONE);
  });

  it("should reject invalid token for liquidity", async function () {
    const fakeToken = "0x1234567890123456789012345678901234567890";
    await assert.rejects(
      flashSwap.write.addLiquidity([fakeToken, ONE], { account: owner.account.address })
    );
  });

  it("should reject zero amount liquidity", async function () {
    await assert.rejects(
      flashSwap.write.addLiquidity([aliceToken.address, 0n], { account: owner.account.address })
    );
  });

  it("should reject removal exceeding balance", async function () {
    await assert.rejects(
      flashSwap.write.removeLiquidity([aliceToken.address, ONE * 100n], { account: owner.account.address })
    );
  });

  it("should allow owner to set exchange rate", async function () {
    const newRate = 2000000000000000000n; // 2 * 10^18
    await flashSwap.write.setExchangeRate([newRate], { account: owner.account.address });

    const rate = await flashSwap.read.exchangeRate();
    assert.equal(rate, newRate);

    // 恢复初始汇率以便后续测试
    await flashSwap.write.setExchangeRate([INITIAL_EXCHANGE_RATE], { account: owner.account.address });
  });

  it("should reject zero exchange rate", async function () {
    await assert.rejects(
      flashSwap.write.setExchangeRate([0n], { account: owner.account.address })
    );
  });

  it("should calculate correct Alice to Bob amount", async function () {
    const aliceAmount = 10n ** 18n; // 1 Alice
    // bobAmount = (aliceAmount * 1e18) / exchangeRate = 1e18 / 1.5e18 = 0.666...e18
    const expectedBob = (aliceAmount * (10n ** 18n)) / INITIAL_EXCHANGE_RATE;
    const actualBob = await flashSwap.read.getAliceToBobAmount([aliceAmount]);

    assert.equal(actualBob, expectedBob);
  });

  it("should calculate correct Bob to Alice amount", async function () {
    const bobAmount = 10n ** 18n; // 1 Bob
    // aliceAmount = (bobAmount * exchangeRate) / 1e18 = 1e18 * 1.5e18 / 1e18 = 1.5e18
    const expectedAlice = (bobAmount * INITIAL_EXCHANGE_RATE) / (10n ** 18n);
    const actualAlice = await flashSwap.read.getBobToAliceAmount([bobAmount]);

    assert.equal(actualAlice, expectedAlice);
  });

  describe("SwapAliceToBob", function () {
    it("should swap Alice to Bob correctly", async function () {
      const swapAmount = 10n ** 18n; // 1 Alice

      await aliceToken.write.approve([flashSwap.address, swapAmount], { account: user1.account.address });

      const userBobBefore = await bobToken.read.balanceOf([user1.account.address]);

      await flashSwap.write.swapAliceToBob([swapAmount], { account: user1.account.address });

      const userBobAfter = await bobToken.read.balanceOf([user1.account.address]);
      const bobReceived = userBobAfter - userBobBefore;

      const expectedBob = (swapAmount * (10n ** 18n)) / INITIAL_EXCHANGE_RATE;
      assert.equal(bobReceived, expectedBob);
    });

    it("should reject zero amount swap", async function () {
      await assert.rejects(
        flashSwap.write.swapAliceToBob([0n], { account: user1.account.address })
      );
    });

    it("should reject swap exceeding liquidity", async function () {
      await assert.rejects(
        flashSwap.write.swapAliceToBob([ONE * 100n], { account: user1.account.address })
      );
    });
  });

  describe("SwapBobToAlice", function () {
    it("should swap Bob to Alice correctly", async function () {
      const swapAmount = 10n ** 18n; // 1 Bob

      await bobToken.write.approve([flashSwap.address, swapAmount], { account: user1.account.address });

      const userAliceBefore = await aliceToken.read.balanceOf([user1.account.address]);

      await flashSwap.write.swapBobToAlice([swapAmount], { account: user1.account.address });

      const userAliceAfter = await aliceToken.read.balanceOf([user1.account.address]);
      const aliceReceived = userAliceAfter - userAliceBefore;

      const expectedAlice = (swapAmount * INITIAL_EXCHANGE_RATE) / (10n ** 18n);
      assert.equal(aliceReceived, expectedAlice);
    });

    it("should reject zero amount swap", async function () {
      await assert.rejects(
        flashSwap.write.swapBobToAlice([0n], { account: user1.account.address })
      );
    });

    it("should reject swap exceeding liquidity", async function () {
      await assert.rejects(
        flashSwap.write.swapBobToAlice([ONE * 100n], { account: user1.account.address })
      );
    });
  });
});
