import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network, viem } from "hardhat";

describe("AliceToken", async function () {
  const { viem: viemInstance } = await network.connect();
  const [owner, user1] = await viemInstance.getWalletClients();

  let aliceToken: any;

  before(async () => {
    aliceToken = await viemInstance.deployContract("AliceToken", [owner.account.address]);
  });

  it("should have correct name and symbol", async function () {
    const name = await aliceToken.read.name();
    const symbol = await aliceToken.read.symbol();

    assert.equal(name, "Alice Dollar");
    assert.equal(symbol, "ALC");
  });

  it("should mint tokens when called by owner", async function () {
    const initialSupply = await aliceToken.read.totalSupply();
    assert.equal(initialSupply, 0n);

    await aliceToken.write.mint([user1.account.address, 1000n], { account: owner.account });

    const balance = await aliceToken.read.balanceOf([user1.account.address]);
    assert.equal(balance, 1000n);
  });

  it("should not allow non-owner to mint", async function () {
    await assert.rejects(
      aliceToken.write.mint([user1.account.address, 1000n], { account: user1.account })
    );
  });
});

describe("AliceFaucet", async function () {
  const { viem: viemInstance } = await network.connect();
  const [owner, user1, user2] = await viemInstance.getWalletClients();

  let aliceFaucet: any;
  let aliceToken: any;
  const DRIP_AMOUNT = 200n;
  const COOLDOWN = 120n; // 120 秒冷却

  before(async () => {
    aliceFaucet = await viemInstance.deployContract("AliceFaucet", [
      1000000n, // initialSupply
      DRIP_AMOUNT,
      COOLDOWN,
    ]);
    // 获取 faucet 创建的 AliceToken
    const tokenAddress = await aliceFaucet.read.token();
    aliceToken = await viemInstance.getContractAt("AliceToken", tokenAddress);
  });

  it("should have correct drip amount and cooldown", async function () {
    const drip = await aliceFaucet.read.dripAmount();
    const cooldown = await aliceFaucet.read.cooldown();

    assert.equal(drip, DRIP_AMOUNT);
    assert.equal(cooldown, COOLDOWN);
  });

  it("should allow user to claim tokens", async function () {
    const initialBalance = await aliceToken.read.balanceOf([user1.account.address]);

    await aliceFaucet.write.claim({ account: user1.account });

    const finalBalance = await aliceToken.read.balanceOf([user1.account.address]);
    assert.equal(finalBalance, initialBalance + DRIP_AMOUNT);
  });

  it("should enforce cooldown between claims", async function () {
    // 第一次领取应该成功
    await aliceFaucet.write.claim({ account: user2.account });

    // 第二次领取应该在冷却期内，预期失败
    await assert.rejects(aliceFaucet.write.claim({ account: user2.account }));
  });

  it("should allow refill by owner", async function () {
    const initialBalance = await aliceToken.read.balanceOf([aliceFaucet.address]);

    await aliceFaucet.write.refill([500n], { account: owner.account });

    const finalBalance = await aliceToken.read.balanceOf([aliceFaucet.address]);
    assert.equal(finalBalance, initialBalance + 500n);
  });

  it("should not allow non-owner to refill", async function () {
    await assert.rejects(
      aliceFaucet.write.refill([500n], { account: user1.account })
    );
  });
});
