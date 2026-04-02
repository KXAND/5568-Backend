// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FlashLoanPool, IFlashLoanReceiver} from "./FlashLoanPool.sol";

import "./LendingPool.sol";

contract FlashLoanBot is IFlashLoanReceiver {
    using SafeERC20 for IERC20;

    FlashLoanPool public flashPool;
    LendingPool public lendingPool;
    
    event Log(string message, uint256 value);
    
    constructor(address _flashPool, address _lendingPool) {
        flashPool = FlashLoanPool(_flashPool);
        lendingPool = LendingPool(_lendingPool);
    }
    
    // 用户调用这个函数
    function borrow(address token, uint256 amount) external {
        emit Log("Borrow called", amount);
        flashPool.flashLoan(token, amount, address(this), "");
    }
    
    // 闪电贷回�?
    function executeOperation(
        address token,
        uint256 amount,
        uint256 fee,
        address,
        bytes calldata
    ) external override returns (bool) {
        emit Log("ExecuteOperation called", amount);
        
        require(msg.sender == address(flashPool), "Not flash pool");
        
        // 计算还款金额
        uint256 repayAmount = amount + fee;
        
        // 调用LendingPool中的add函数实现a+b功能
        uint256 testResult = lendingPool.add(7, 5);
        
        // 输出add结果
        emit Log("LendingPool.add result", testResult);
        
        // 实际还款：将代币转回闪电贷池
        IERC20(token).safeTransfer(address(flashPool), repayAmount);
        
        emit Log("Repaid", repayAmount);
        
        return true;
    }
}
