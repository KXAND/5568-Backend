// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FlashLoanSwap
 * @dev 简单的代币兑换合约，支持AliceToken和BobToken之间的交换
 */
contract FlashLoanSwap {
    using SafeERC20 for IERC20;

    IERC20 public aliceToken;
    IERC20 public bobToken;
    IERC20 public charlieToken;
    
    // 交换比例: bobAmount / aliceAmount
    // 例如：如果 exchangeRate = 1.5e18, 则 1 Bob = 1.5 Alice
    uint256 public exchangeRate = 1.5e18; // 1:1.5比例，1个Bob换1.5个Alice
    
    address public owner;
    
    uint256 public totalAliceSwapped;
    uint256 public totalBobSwapped;
    uint256 public totalCharlieSwapped;
    
    event SwapAliceToBob(address indexed user, uint256 aliceAmount, uint256 bobAmount);
    event SwapBobToAlice(address indexed user, uint256 bobAmount, uint256 aliceAmount);
    event SwapAliceToCharlie(address indexed user, uint256 aliceAmount, uint256 charlieAmount);
    event SwapCharlieToAlice(address indexed user, uint256 charlieAmount, uint256 aliceAmount);
    event SwapBobToCharlie(address indexed user, uint256 bobAmount, uint256 charlieAmount);
    event SwapCharlieToBob(address indexed user, uint256 charlieAmount, uint256 bobAmount);
    event ExchangeRateUpdated(uint256 newRate);
    event LiquidityAdded(address indexed token, uint256 amount);
    event LiquidityRemoved(address indexed token, uint256 amount);

    constructor(address _aliceToken, address _bobToken, address _charlieToken) {
        aliceToken = IERC20(_aliceToken);
        bobToken = IERC20(_bobToken);
        charlieToken = IERC20(_charlieToken);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /**
     * @dev 添加流动性
     */
    function addLiquidity(address token, uint256 amount) external onlyOwner {
        require(
            token == address(aliceToken) || token == address(bobToken) || token == address(charlieToken),
            "Invalid token"
        );
        require(amount > 0, "Amount must be > 0");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityAdded(token, amount);
    }

    /**
     * @dev 移除流动性
     */
    function removeLiquidity(address token, uint256 amount) external onlyOwner {
        require(
            token == address(aliceToken) || token == address(bobToken) || token == address(charlieToken),
            "Invalid token"
        );
        require(amount > 0, "Amount must be > 0");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient liquidity");
        
        IERC20(token).safeTransfer(msg.sender, amount);
        emit LiquidityRemoved(token, amount);
    }

    /**
     * @dev 设置交换比例
     * @param _exchangeRate 新的交换率 (1e18为1:1)
     */
    function setExchangeRate(uint256 _exchangeRate) external onlyOwner {
        require(_exchangeRate > 0, "Rate must be > 0");
        exchangeRate = _exchangeRate;
        emit ExchangeRateUpdated(_exchangeRate);
    }

    /**
     * @dev Alice换Bob
     * @param aliceAmount 用户输入的Alice数量
     */
    function swapAliceToBob(uint256 aliceAmount) external {
        require(aliceAmount > 0, "Amount must be > 0");
        
        // 计算能换得的Bob数量
        uint256 bobAmount = (aliceAmount * 1e18) / exchangeRate;
        
        // 检查池子是否有足够的Bob
        require(bobToken.balanceOf(address(this)) >= bobAmount, "Insufficient liquidity");
        
        // 从用户转入Alice
        aliceToken.safeTransferFrom(msg.sender, address(this), aliceAmount);
        
        // 转出Bob给用户
        bobToken.safeTransfer(msg.sender, bobAmount);
        
        // 记录统计
        totalAliceSwapped += aliceAmount;
        totalBobSwapped += bobAmount;
        
        emit SwapAliceToBob(msg.sender, aliceAmount, bobAmount);
    }

    /**
     * @dev Bob换Alice
     * @param bobAmount 用户输入的Bob数量
     */
    function swapBobToAlice(uint256 bobAmount) external {
        require(bobAmount > 0, "Amount must be > 0");
        
        // 计算能换得的Alice数量
        uint256 aliceAmount = (bobAmount * exchangeRate) / 1e18;
        
        // 检查池子是否有足够的Alice
        require(aliceToken.balanceOf(address(this)) >= aliceAmount, "Insufficient liquidity");
        
        // 从用户转入Bob
        bobToken.safeTransferFrom(msg.sender, address(this), bobAmount);
        
        // 转出Alice给用户
        aliceToken.safeTransfer(msg.sender, aliceAmount);
        
        // 记录统计
        totalBobSwapped += bobAmount;
        totalAliceSwapped += aliceAmount;
        
        emit SwapBobToAlice(msg.sender, bobAmount, aliceAmount);
    }

    function swapAliceToCharlie(uint256 aliceAmount) external {
        require(aliceAmount > 0, "Amount must be > 0");
        require(charlieToken.balanceOf(address(this)) >= aliceAmount, "Insufficient liquidity");

        aliceToken.safeTransferFrom(msg.sender, address(this), aliceAmount);
        charlieToken.safeTransfer(msg.sender, aliceAmount);

        totalAliceSwapped += aliceAmount;
        totalCharlieSwapped += aliceAmount;

        emit SwapAliceToCharlie(msg.sender, aliceAmount, aliceAmount);
    }

    function swapCharlieToAlice(uint256 charlieAmount) external {
        require(charlieAmount > 0, "Amount must be > 0");
        require(aliceToken.balanceOf(address(this)) >= charlieAmount, "Insufficient liquidity");

        charlieToken.safeTransferFrom(msg.sender, address(this), charlieAmount);
        aliceToken.safeTransfer(msg.sender, charlieAmount);

        totalCharlieSwapped += charlieAmount;
        totalAliceSwapped += charlieAmount;

        emit SwapCharlieToAlice(msg.sender, charlieAmount, charlieAmount);
    }

    function swapBobToCharlie(uint256 bobAmount) external {
        require(bobAmount > 0, "Amount must be > 0");

        uint256 charlieAmount = (bobAmount * exchangeRate) / 1e18;
        require(charlieToken.balanceOf(address(this)) >= charlieAmount, "Insufficient liquidity");

        bobToken.safeTransferFrom(msg.sender, address(this), bobAmount);
        charlieToken.safeTransfer(msg.sender, charlieAmount);

        totalBobSwapped += bobAmount;
        totalCharlieSwapped += charlieAmount;

        emit SwapBobToCharlie(msg.sender, bobAmount, charlieAmount);
    }

    function swapCharlieToBob(uint256 charlieAmount) external {
        require(charlieAmount > 0, "Amount must be > 0");

        uint256 bobAmount = (charlieAmount * 1e18) / exchangeRate;
        require(bobToken.balanceOf(address(this)) >= bobAmount, "Insufficient liquidity");

        charlieToken.safeTransferFrom(msg.sender, address(this), charlieAmount);
        bobToken.safeTransfer(msg.sender, bobAmount);

        totalCharlieSwapped += charlieAmount;
        totalBobSwapped += bobAmount;

        emit SwapCharlieToBob(msg.sender, charlieAmount, bobAmount);
    }

    /**
     * @dev 获取Alice换Bob的输出数量
     */
    function getAliceToBobAmount(uint256 aliceAmount) external view returns (uint256) {
        return (aliceAmount * 1e18) / exchangeRate;
    }

    /**
     * @dev 获取Bob换Alice的输出数量
     */
    function getBobToAliceAmount(uint256 bobAmount) external view returns (uint256) {
        return (bobAmount * exchangeRate) / 1e18;
    }

    /**
     * @dev 获取池子状态
     */
    function getPoolStatus() external view returns (uint256 aliceBalance, uint256 bobBalance) {
        aliceBalance = aliceToken.balanceOf(address(this));
        bobBalance = bobToken.balanceOf(address(this));
    }

    /**
     * @dev 获取统计信息
     */
    function getStats() external view returns (uint256 aliceTotal, uint256 bobTotal) {
        aliceTotal = totalAliceSwapped;
        bobTotal = totalBobSwapped;
    }
}
