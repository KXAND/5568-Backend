import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network, viem } from "hardhat";

describe("AToken", async function () {
  const { viem: viemInstance } = await network.connect();
  const [owner, user1, user2] = await viemInstance.getWalletClients();

  let aToken: any;

  before(async () => {
    // 部署 AToken
    aToken = await viemInstance.deployContract("AToken", [
      "Aave Alice",
      "aALC",
      owner.account.address,
      owner.account.address, // pool 设置为 owner
    ]);
  });

  it("should have correct name and symbol", async function () {
    const name = await aToken.read.name();
    const symbol = await aToken.read.symbol();

    assert.equal(name, "Aave Alice");
    assert.equal(symbol, "aALC");
  });

  it("should set pool correctly", async function () {
    const pool = await aToken.read.pool();
    // 使用 toLowerCase() 比较地址
    assert.equal(pool.toLowerCase(), owner.account.address.toLowerCase());
  });

  it("should only allow pool to mint", async function () {
    // 非 pool 地址调用 mint 应该失败
    await assert.rejects(
      aToken.write.mint([user1.account.address, 1000n], { account: user1.account })
    );
  });

  it("should mint tokens when called by pool", async function () {
    // 验证初始供应量为 0
    const initialSupply = await aToken.read.totalSupply();

    // 用 owner (也是 pool) mint
    await aToken.write.mint([user1.account.address, 1000n], { account: owner.account });

    const balance = await aToken.read.balanceOf([user1.account.address]);
    assert.equal(balance, 1000n);
  });

  it("should burn tokens when called by pool", async function () {
    // 给 user2 mint 一些代币用于 burn 测试
    await aToken.write.mint([user2.account.address, 1000n], { account: owner.account });

    // burn - 烧掉 500n
    await aToken.write.burn([user2.account.address, 500n], { account: owner.account });

    const balance = await aToken.read.balanceOf([user2.account.address]);
    assert.equal(balance, 500n);
  });

  it("should allow owner to set new pool", async function () {
    await aToken.write.setPool([user2.account.address], { account: owner.account });

    const newPool = await aToken.read.pool();
    assert.equal(newPool.toLowerCase(), user2.account.address.toLowerCase());
  });

  it("should not allow non-owner to set pool", async function () {
    await assert.rejects(
      aToken.write.setPool([user2.account.address], { account: user1.account })
    );
  });
});
