import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network, viem } from "hardhat";

describe("SimpleOracle", async function () {
  const { viem: viemInstance } = await network.connect();
  const [owner, user1] = await viemInstance.getWalletClients();

  let oracle: any;
  const TEST_ASSET = "0x1234567890123456789012345678901234567890";
  const E18 = 10n ** 18n;
  const TEST_PRICE = 1500n * E18; // $1500

  before(async () => {
    // SimpleOracle 构造函数不接受参数
    oracle = await viemInstance.deployContract("SimpleOracle", []);
  });

  it("should set price when called by owner", async function () {
    // 初始价格应该是 0
    const initialPrice = await oracle.read.getPrice([TEST_ASSET]);
    assert.equal(initialPrice, 0n);

    // owner 设置价格
    await oracle.write.setPrice([TEST_ASSET, TEST_PRICE], { account: owner.account.address });

    // 验证价格已设置
    const price = await oracle.read.getPrice([TEST_ASSET]);
    assert.equal(price, TEST_PRICE);
  });

  it("should allow updating price", async function () {
    await oracle.write.setPrice([TEST_ASSET, TEST_PRICE], { account: owner.account.address });

    const newPrice = 2000n * E18;
    await oracle.write.setPrice([TEST_ASSET, newPrice], { account: owner.account.address });

    const price = await oracle.read.getPrice([TEST_ASSET]);
    assert.equal(price, newPrice);
  });

  it("should not allow non-owner to set price", async function () {
    await assert.rejects(
      oracle.write.setPrice([TEST_ASSET, TEST_PRICE], { account: user1.account.address })
    );
  });

  it("should return 0 for unset asset", async function () {
    const unsetAsset = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const price = await oracle.read.getPrice([unsetAsset]);
    assert.equal(price, 0n);
  });

  it("should support multiple assets", async function () {
    const asset1 = "0x1111111111111111111111111111111111111111";
    const asset2 = "0x2222222222222222222222222222222222222222";

    await oracle.write.setPrice([asset1, 1000n * E18], { account: owner.account.address });
    await oracle.write.setPrice([asset2, 2000n * E18], { account: owner.account.address });

    const price1 = await oracle.read.getPrice([asset1]);
    const price2 = await oracle.read.getPrice([asset2]);

    assert.equal(price1, 1000n * E18);
    assert.equal(price2, 2000n * E18);
  });
});
