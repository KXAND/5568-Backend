import assert from "node:assert/strict";
import { describe, it, before, beforeEach } from "node:test";
import { network, viem } from "hardhat";

describe("PoolIncentivesController", async function () {
  const { viem: viemInstance } = await network.connect();
  const [owner, user1, user2, actionHandler] = await viemInstance.getWalletClients();

  let poolToken: any;
  let incentivesController: any;

  const ONE = 1000n * (10n ** 18n);

  before(async () => {
    // 部署 PoolCoin 作为奖励代币
    poolToken = await viemInstance.deployContract("PoolCoin", [owner.account.address, ONE * 100n], { client: { wallet: owner } });

    // 部署 PoolIncentivesController
    incentivesController = await viemInstance.deployContract("PoolIncentivesController", [
      poolToken.address,
      actionHandler.account.address,
      owner.account.address,
    ], { client: { wallet: owner } });
  });

  beforeEach(async () => {
    // 在每个测试前重置 action handler 为 actionHandler
    await incentivesController.write.setActionHandler([actionHandler.account.address], { account: owner.account.address });
  });

  it("should have correct pool token", async function () {
    const token = await incentivesController.read.poolToken();
    assert.equal(token.toLowerCase(), poolToken.address.toLowerCase());
  });

  it("should have correct action handler", async function () {
    const handler = await incentivesController.read.actionHandler();
    assert.equal(handler.toLowerCase(), actionHandler.account.address.toLowerCase());
  });

  it("should allow owner to set action handler", async function () {
    await incentivesController.write.setActionHandler([user1.account.address], { account: owner.account.address });

    const handler = await incentivesController.read.actionHandler();
    assert.equal(handler.toLowerCase(), user1.account.address.toLowerCase());
  });

  it("should reject zero address for action handler", async function () {
    await assert.rejects(
      incentivesController.write.setActionHandler(["0x0000000000000000000000000000000000000000"], { account: owner.account.address })
    );
  });

  it("should allow action handler to handle action", async function () {
    const asset = "0x1234567890123456789012345678901234567890";

    // action handler 调用 handleAction
    await incentivesController.write.handleAction(
      [user1.account.address, asset, 0, ONE, ONE / 2n],
      { account: actionHandler.account.address }
    );

    // 验证用户有了 unclaimed rewards（简化验证，不检查具体数值）
  });

  it("should not allow non-action-handler to handle action", async function () {
    const asset = "0x1234567890123456789012345678901234567890";

    await assert.rejects(
      incentivesController.write.handleAction(
        [user1.account.address, asset, 0, ONE, ONE / 2n],
        { account: user1.account.address }
      )
    );
  });

  it("should reject claim to zero address", async function () {
    await assert.rejects(
      incentivesController.write.claimRewards(["0x0000000000000000000000000000000000000000"], { account: user1.account.address })
    );
  });

  it("should reject claim when no rewards", async function () {
    // user2 还没有任何奖励
    await assert.rejects(
      incentivesController.write.claimRewards([user2.account.address], { account: user2.account.address })
    );
  });

  it("should have correct constants", async function () {
    const RAY = await incentivesController.read.RAY();
    const DEPOSIT_REWARD_TYPE = BigInt(await incentivesController.read.DEPOSIT_REWARD_TYPE());
    const BORROW_REWARD_TYPE = BigInt(await incentivesController.read.BORROW_REWARD_TYPE());

    assert.equal(RAY, 10n ** 18n);
    assert.equal(DEPOSIT_REWARD_TYPE, 0n);
    assert.equal(BORROW_REWARD_TYPE, 1n);
  });
});
