// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IPoolIncentivesController {
    function handleAction(
        address user,
        address asset,
        uint8 rewardType,
        uint256 totalPrincipal,
        uint256 userPrincipal
    ) external;
}

contract PoolIncentivesController is Ownable, IPoolIncentivesController {
    using SafeERC20 for IERC20;

    uint256 public constant RAY = 1e18;
    uint8 public constant DEPOSIT_REWARD_TYPE = 0;
    uint8 public constant BORROW_REWARD_TYPE = 1;

    struct RewardData {
        uint256 index;
        uint256 emissionPerSecond;
        uint256 lastUpdateTimestamp;
    }

    IERC20 public immutable poolToken;
    address public actionHandler;

    mapping(bytes32 => RewardData) public rewards;
    mapping(bytes32 => mapping(address => uint256)) public userIndex;
    mapping(address => uint256) public unclaimedRewards;

    event ActionHandlerUpdated(address indexed newHandler);
    event RewardConfigured(
        address indexed asset,
        uint8 indexed rewardType,
        uint256 emissionPerSecond
    );
    event RewardsAccrued(
        address indexed user,
        address indexed asset,
        uint8 indexed rewardType,
        uint256 amount
    );
    event RewardsClaimed(address indexed user, address indexed to, uint256 amount);

    modifier onlyActionHandler() {
        require(msg.sender == actionHandler, "Incentives: forbidden");
        _;
    }

    constructor(
        address poolToken_,
        address actionHandler_,
        address initialOwner
    ) Ownable(initialOwner) {
        require(poolToken_ != address(0), "Incentives: bad token");
        require(actionHandler_ != address(0), "Incentives: bad handler");
        poolToken = IERC20(poolToken_);
        actionHandler = actionHandler_;
    }

    function setActionHandler(address newHandler) external onlyOwner {
        require(newHandler != address(0), "Incentives: bad handler");
        actionHandler = newHandler;
        emit ActionHandlerUpdated(newHandler);
    }

    function configureReward(
        address asset,
        uint8 rewardType,
        uint256 emissionPerSecond
    ) external onlyOwner {
        bytes32 rewardKey = _rewardKey(asset, rewardType);
        rewards[rewardKey].emissionPerSecond = emissionPerSecond;
        rewards[rewardKey].lastUpdateTimestamp = block.timestamp;

        emit RewardConfigured(asset, rewardType, emissionPerSecond);
    }

    function handleAction(
        address user,
        address asset,
        uint8 rewardType,
        uint256 totalPrincipal,
        uint256 userPrincipal
    ) external onlyActionHandler {
        bytes32 rewardKey = _rewardKey(asset, rewardType);
        uint256 nextIndex = _updateRewardIndex(rewardKey, totalPrincipal);
        _accrueUserReward(
            rewardKey,
            user,
            asset,
            rewardType,
            nextIndex,
            userPrincipal
        );
    }

    function claimRewards(address to) external returns (uint256 claimed) {
        require(to != address(0), "Incentives: bad to");

        claimed = unclaimedRewards[msg.sender];
        require(claimed > 0, "Incentives: no rewards");

        unclaimedRewards[msg.sender] = 0;
        poolToken.safeTransfer(to, claimed);

        emit RewardsClaimed(msg.sender, to, claimed);
    }

    function _updateRewardIndex(
        bytes32 rewardKey,
        uint256 totalPrincipal
    ) internal returns (uint256 nextIndex) {
        RewardData storage reward = rewards[rewardKey];
        nextIndex = reward.index;

        uint256 lastUpdateTimestamp = reward.lastUpdateTimestamp;
        if (lastUpdateTimestamp == 0) {
            reward.lastUpdateTimestamp = block.timestamp;
            return nextIndex;
        }

        if (block.timestamp == lastUpdateTimestamp) {
            return nextIndex;
        }

        reward.lastUpdateTimestamp = block.timestamp;

        if (reward.emissionPerSecond == 0 || totalPrincipal == 0) {
            return nextIndex;
        }

        nextIndex +=
            (reward.emissionPerSecond *
                (block.timestamp - lastUpdateTimestamp) *
                RAY) /
            totalPrincipal;
        reward.index = nextIndex;
    }

    function _accrueUserReward(
        bytes32 rewardKey,
        address user,
        address asset,
        uint8 rewardType,
        uint256 nextIndex,
        uint256 userPrincipal
    ) internal {
        uint256 previousUserIndex = userIndex[rewardKey][user];
        userIndex[rewardKey][user] = nextIndex;

        if (nextIndex == previousUserIndex || userPrincipal == 0) {
            return;
        }

        uint256 accrued = (userPrincipal * (nextIndex - previousUserIndex)) /
            RAY;
        if (accrued == 0) {
            return;
        }

        unclaimedRewards[user] += accrued;
        emit RewardsAccrued(user, asset, rewardType, accrued);
    }

    function _rewardKey(
        address asset,
        uint8 rewardType
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(asset, rewardType));
    }
}
