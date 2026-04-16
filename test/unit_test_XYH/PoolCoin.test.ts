import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network, viem } from "hardhat";

describe("PoolCoin", async function () {
  const { viem: viemInstance } = await network.connect();
  const [owner, user1] = await viemInstance.getWalletClients();

  let poolCoin: any;
  const INITIAL_SUPPLY = 1000000n * (10n ** 18n);

  before(async () => {
    poolCoin = await viemInstance.deployContract("PoolCoin", [
      owner.account.address,
      INITIAL_SUPPLY,
    ]);
  });

  it("should have correct name and symbol", async function () {
    const name = await poolCoin.read.name();
    const symbol = await poolCoin.read.symbol();

    assert.equal(name, "PoolCoin");
    assert.equal(symbol, "POOL");
  });

  it("should have correct initial supply", async function () {
    const totalSupply = await poolCoin.read.totalSupply();
    assert.equal(totalSupply, INITIAL_SUPPLY);
  });

  it("should mint all tokens to initial holder", async function () {
    const balance = await poolCoin.read.balanceOf([owner.account.address]);
    assert.equal(balance, INITIAL_SUPPLY);
  });

  it("should reject zero address as initial holder", async function () {
    await assert.rejects(
      viemInstance.deployContract("PoolCoin", [
        "0x0000000000000000000000000000000000000000",
        INITIAL_SUPPLY,
      ])
    );
  });

  it("should support transfer", async function () {
    const transferAmount = 1000n * (10n ** 18n);

    await poolCoin.write.transfer([user1.account.address, transferAmount], { account: owner.account.address });

    const userBalance = await poolCoin.read.balanceOf([user1.account.address]);
    assert.equal(userBalance, transferAmount);

    const ownerBalance = await poolCoin.read.balanceOf([owner.account.address]);
    assert.equal(ownerBalance, INITIAL_SUPPLY - transferAmount);
  });
});
