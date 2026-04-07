// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FlashLoanPool, IFlashLoanReceiver} from "./FlashLoanPool.sol";

import "../LendingPool.sol";
import "./FlashLoanSwap.sol";

contract FlashLoanBot is IFlashLoanReceiver {
    using SafeERC20 for IERC20;

    FlashLoanPool public flashPool;
    LendingPool public lendingPool;
    FlashLoanSwap public swap;
    
    event Log(string message, uint256 value);
    
    constructor(address _flashPool, address _lendingPool, address _swap) {
        flashPool = FlashLoanPool(_flashPool);
        lendingPool = LendingPool(_lendingPool);
        swap = FlashLoanSwap(_swap);
    }
    
    // 用户调用这个函数
    function borrow(address token, uint256 amount, address borrower) external {
        emit Log("Borrow called", amount);
        // 将borrower地址编码到data中传递给executeOperation
        bytes memory data = abi.encode(borrower);
        flashPool.flashLoan(token, amount, address(this), data);
    }
    
    // 闪电贷
    function executeOperation(
        address token,
        uint256 amount,
        uint256 fee,
        address,
        bytes calldata data
    ) external override returns (bool) {
        emit Log("ExecuteOperation called", amount);
        
        require(msg.sender == address(flashPool), "Not flash pool");
        
        // 解码borrower地址
        address borrower = abi.decode(data, (address));
        emit Log("Borrower decoded", uint256(uint160(borrower)));
        
        // 计算还款金额
        uint256 repayAmount = amount + fee;
        emit Log("Repay amount calculated", repayAmount);
        
        // 获取抵押品代币地址
        address collateralAddr = address(lendingPool.collateralToken());
        emit Log("Collateral token", uint256(uint160(collateralAddr)));
        
        // 记录清算前的抵押品余额
        uint256 collateralBefore = IERC20(collateralAddr).balanceOf(address(this));
        emit Log("Collateral before liquidation", collateralBefore);
        
        // 批准borrowToken给LendingPool用于清算
        IERC20(token).approve(address(lendingPool), repayAmount);
        emit Log("Approved lending pool", repayAmount);
        
        // 调用LendingPool的liquidate函数
        lendingPool.liquidate(borrower, repayAmount);
        emit Log("Liquidation executed", repayAmount);
        
        // 计算获得的抵押品数量
        uint256 collateralReceived = IERC20(collateralAddr).balanceOf(address(this)) - collateralBefore;
        emit Log("Collateral received", collateralReceived);
        
        // 如果获得了抵押品，通过swap换成borrowToken
        if (collateralReceived > 0) {
            // 批准抵押品给swap合约
            IERC20(collateralAddr).approve(address(swap), collateralReceived);
            emit Log("Approved swap", collateralReceived);
            
            // 将抵押品换成borrowToken (Bob -> Alice)
            swap.swapBobToAlice(collateralReceived);
            emit Log("Swapped collateral to repay token", collateralReceived);
        }
        
        // 检查是否有足够的代币还款
        uint256 currentBalance = IERC20(token).balanceOf(address(this));
        emit Log("Current balance", currentBalance);
        require(currentBalance >= repayAmount, "Insufficient balance for repayment");
        
        // 实际还款：将代币转回闪电贷池
        IERC20(token).safeTransfer(address(flashPool), repayAmount);
        emit Log("Repaid", repayAmount);
        
        return true;
    }
}
