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
    
    function borrow(
        address token,
        uint256 amount,
        uint256 debtVaultId,
        address collateralAsset
    ) external {
        emit Log("Borrow called", amount);
        bytes memory data = abi.encode(debtVaultId, collateralAsset);
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
        
        (uint256 debtVaultId, address collateralAsset) = abi.decode(
            data,
            (uint256, address)
        );
        emit Log("DebtVault decoded", debtVaultId);
        emit Log("Collateral asset", uint256(uint160(collateralAsset)));
        
        uint256 repayAmount = amount + fee;
        emit Log("Repay amount calculated", repayAmount);
        
        uint256 claimableSharesBefore = _getClaimableShares(collateralAsset);
        emit Log("Claimable shares before liquidation", claimableSharesBefore);
        
        IERC20(token).approve(address(lendingPool), repayAmount);
        emit Log("Approved lending pool", repayAmount);
        
        lendingPool.liquidate(debtVaultId, token, collateralAsset, repayAmount);
        emit Log("Liquidation executed", repayAmount);

        _processCollateral(token, collateralAsset, claimableSharesBefore);
        
        uint256 currentBalance = IERC20(token).balanceOf(address(this));
        emit Log("Current balance", currentBalance);
        require(currentBalance >= repayAmount, "Insufficient balance for repayment");
        
        IERC20(token).safeTransfer(address(flashPool), repayAmount);
        emit Log("Repaid", repayAmount);
        
        return true;
    }

    function _processCollateral(
        address token,
        address collateralAsset,
        uint256 claimableSharesBefore
    ) internal {
        uint256 collateralSharesSeized =
            _getClaimableShares(collateralAsset) - claimableSharesBefore;
        emit Log("Collateral shares seized", collateralSharesSeized);

        if (collateralSharesSeized == 0) {
            return;
        }

        uint256 collateralReceived = _assetAmountFromShares(
            collateralAsset,
            collateralSharesSeized
        );
        emit Log("Collateral amount available", collateralReceived);

        if (collateralReceived == 0) {
            return;
        }

        lendingPool.withdraw(collateralAsset, collateralReceived);
        emit Log("Withdrew collateral underlying", collateralReceived);

        if (collateralAsset == token) {
            return;
        }

        IERC20(collateralAsset).approve(address(swap), collateralReceived);
        emit Log("Approved swap", collateralReceived);
        _swapCollateral(token, collateralAsset, collateralReceived);
        emit Log("Swapped collateral to repay token", collateralReceived);
    }

    function _swapCollateral(
        address token,
        address collateralAsset,
        uint256 collateralReceived
    ) internal {
        if (
            collateralAsset == address(swap.bobToken()) &&
            token == address(swap.aliceToken())
        ) {
            swap.swapBobToAlice(collateralReceived);
            return;
        }

        if (
            collateralAsset == address(swap.aliceToken()) &&
            token == address(swap.bobToken())
        ) {
            swap.swapAliceToBob(collateralReceived);
            return;
        }

        if (
            collateralAsset == address(swap.aliceToken()) &&
            token == address(swap.charlieToken())
        ) {
            swap.swapAliceToCharlie(collateralReceived);
            return;
        }

        if (
            collateralAsset == address(swap.charlieToken()) &&
            token == address(swap.aliceToken())
        ) {
            swap.swapCharlieToAlice(collateralReceived);
            return;
        }

        if (
            collateralAsset == address(swap.bobToken()) &&
            token == address(swap.charlieToken())
        ) {
            swap.swapBobToCharlie(collateralReceived);
            return;
        }

        if (
            collateralAsset == address(swap.charlieToken()) &&
            token == address(swap.bobToken())
        ) {
            swap.swapCharlieToBob(collateralReceived);
            return;
        }

        revert("Unsupported swap pair");
    }

    function _getClaimableShares(
        address asset
    ) internal view returns (uint256) {
        return lendingPool.getUserClaimableShares(address(this), asset);
    }

    function _assetAmountFromShares(
        address asset,
        uint256 shares
    ) internal view returns (uint256 amount) {
        (, , , , , , , , uint256 liquidityIndex, , , ) = lendingPool.reserves(
            asset
        );
        amount = (shares * liquidityIndex) / lendingPool.RAY();
    }
}
