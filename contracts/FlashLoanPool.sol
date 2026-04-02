// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FlashLoanPool is Ownable {
    using SafeERC20 for IERC20;
    
    IERC20 public aliceToken;
    IERC20 public bobToken;
    
    uint256 public feeRate = 0;  // 0% 手续费，简化测试
    uint256 public constant FEE_BASE = 10000;
    
    event FlashLoan(
        address indexed borrower,
        address indexed token,
        uint256 amount,
        uint256 fee
    );
    
    event Deposit(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    event Withdraw(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    constructor(address _aliceToken, address _bobToken) Ownable(msg.sender) {
        aliceToken = IERC20(_aliceToken);
        bobToken = IERC20(_bobToken);
    }
    
    function deposit(address token, uint256 amount) external {
        require(token == address(aliceToken) || token == address(bobToken), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        emit Deposit(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external onlyOwner {
        require(token == address(aliceToken) || token == address(bobToken), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
        
        IERC20(token).safeTransfer(msg.sender, amount);
        
        emit Withdraw(msg.sender, token, amount);
    }
    
    function flashLoan(
        address token,
        uint256 amount,
        address target,
        bytes calldata data
    ) external {
        require(token == address(aliceToken) || token == address(bobToken), "Unsupported token");
        
        IERC20 flashToken = IERC20(token);
        uint256 poolBalance = flashToken.balanceOf(address(this));
        require(poolBalance >= amount, "Insufficient liquidity");
        
        uint256 fee = (amount * feeRate) / FEE_BASE;
        
        // 借出
        flashToken.safeTransfer(target, amount);
        
        // 调用回调
        try IFlashLoanReceiver(target).executeOperation(token, amount, fee, msg.sender, data) returns (bool success) {
            require(success, "Callback failed");
        } catch {
            revert("Callback reverted");
        }
        
        // 检查还款
        uint256 newBalance = flashToken.balanceOf(address(this));
        require(newBalance >= poolBalance + fee, "Flash loan not repaid");
        
        emit FlashLoan(target, token, amount, fee);
    }
    
    function setFeeRate(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 500, "Fee too high");
        feeRate = _feeRate;
    }
    
    function getBalance(address token) external view returns (uint256) {
        require(token == address(aliceToken) || token == address(bobToken), "Invalid token");
        return IERC20(token).balanceOf(address(this));
    }
}

interface IFlashLoanReceiver {
    function executeOperation(
        address token,
        uint256 amount,
        uint256 fee,
        address initiator,
        bytes calldata data
    ) external returns (bool);
}