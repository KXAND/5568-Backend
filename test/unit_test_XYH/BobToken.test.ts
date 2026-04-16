import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network, viem } from "hardhat";

describe("BobToken", async function () {
  const { viem: viemInstance } = await network.connect();
  const [owner, user1] = await viemInstance.getWalletClients();

  let bobToken: any;

  before(async () => {
    bobToken = await viemInstance.deployContract("BobToken", [owner.account.address]);
  });

  it("should have correct name and symbol", async function () {
    const name = await bobToken.read.name();
    const symbol = await bobToken.read.symbol();

    assert.equal(name, "Bob Token");
    assert.equal(symbol, "BOB");
  });

  it("should mint tokens when called by owner", async function () {
    const initialSupply = await bobToken.read.totalSupply();
    assert.equal(initialSupply, 0n);

    await bobToken.write.mint([user1.account.address, 1000n], { account: owner.account });

    const balance = await bobToken.read.balanceOf([user1.account.address]);
    assert.equal(balance, 1000n);
  });

  it("should not allow non-owner to mint", async function () {
    await assert.rejects(
      bobToken.write.mint([user1.account.address, 1000n], { account: user1.account })
    );
  });
});

describe("BobFaucet", async function () {
  const { viem: viemInstance } = await network.connect();
  const [owner, user1, user2] = await viemInstance.getWalletClients();

  let bobFaucet: any;
  let bobToken: any;
  const DRIP_AMOUNT = 100n;
  const COOLDOWN = 60n; // 60 秒冷却

  before(async () => {
    bobFaucet = await viemInstance.deployContract("BobFaucet", [
      1000000n, // initialSupply
      DRIP_AMOUNT,
      COOLDOWN,
    ]);
    // 获取 faucet 创建的 BobToken
    const tokenAddress = await bobFaucet.read.token();
    bobToken = await viemInstance.getContractAt("BobToken", tokenAddress);
  });

  it("should have correct drip amount and cooldown", async function () {
    const drip = await bobFaucet.read.dripAmount();
    const cooldown = await bobFaucet.read.cooldown();

    assert.equal(drip, DRIP_AMOUNT);
    assert.equal(cooldown, COOLDOWN);
  });

  it("should allow user to claim tokens", async function () {
    const initialBalance = await bobToken.read.balanceOf([user1.account.address]);

    await bobFaucet.write.claim({ account: user1.account });

    const finalBalance = await bobToken.read.balanceOf([user1.account.address]);
    assert.equal(finalBalance, initialBalance + DRIP_AMOUNT);
  });

  it("should enforce cooldown between claims", async function () {
    // 第一次领取应该成功
    await bobFaucet.write.claim({ account: user2.account });

    // 第二次领取应该在冷却期内，预期失败
    await assert.rejects(bobFaucet.write.claim({ account: user2.account }));
  });

  it("should allow refill by owner", async function () {
    const initialBalance = await bobToken.read.balanceOf([bobFaucet.address]);

    await bobFaucet.write.refill([500n], { account: owner.account });

    const finalBalance = await bobToken.read.balanceOf([bobFaucet.address]);
    assert.equal(finalBalance, initialBalance + 500n);
  });

  it("should not allow non-owner to refill", async function () {
    await assert.rejects(
      bobFaucet.write.refill([500n], { account: user1.account })
    );
  });
});
