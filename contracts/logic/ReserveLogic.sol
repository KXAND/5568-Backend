// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {LendingPoolTypes} from "../types/LendingPoolTypes.sol";

library ReserveLogic {
    event Accrue(
        address indexed asset,
        uint256 interest,
        uint256 borrowIndex,
        uint256 liquidityIndex
    );

    function executeAccrueInterest(
        address asset,
        LendingPoolTypes.Reserve storage reserve,
        uint256 assetCash,
        uint256 ray,
        uint256 reserveFactorRay // interest cut of protocol
    ) external returns (uint256 borrowInterest, uint256 protocolInterest) {
        uint256 blocksElapsed = block.number - reserve.lastAccrualBlock;
        if (blocksElapsed == 0) {
            return (0, 0);
        }

        uint256 util = getUtilization(reserve, assetCash, ray);
        uint256 borrowRate = reserve.interestRateModel.getBorrowRate(util);
        uint256 supplyRate = (borrowRate * util * (ray - reserveFactorRay)) /
            ray /
            ray;
        borrowInterest =
            (reserve.totalBorrows * borrowRate * blocksElapsed) /
            ray;
        protocolInterest = (borrowInterest * reserveFactorRay) / ray;

        reserve.totalBorrows += borrowInterest;
        reserve.borrowIndex =
            reserve.borrowIndex +
            (reserve.borrowIndex * borrowRate * blocksElapsed) /
            ray;
        reserve.liquidityIndex =
            reserve.liquidityIndex +
            (reserve.liquidityIndex * supplyRate * blocksElapsed) /
            ray;
        reserve.lastAccrualBlock = block.number;

        emit Accrue(
            asset,
            borrowInterest,
            reserve.borrowIndex,
            reserve.liquidityIndex
        );
    }

    function getUtilization(
        LendingPoolTypes.Reserve storage reserve,
        uint256 assetCash,
        uint256 ray
    ) internal view returns (uint256) {
        if (reserve.totalBorrows == 0 && assetCash == 0) {
            return 0;
        }

        return
            (reserve.totalBorrows * ray) / (assetCash + reserve.totalBorrows);
    }

    function borrowBalance(
        mapping(uint256 => LendingPoolTypes.DebtVault) storage debtVaults,
        uint256 debtVaultId,
        address asset,
        LendingPoolTypes.Reserve storage reserve
    ) external view returns (uint256) {
        uint256 principal = debtVaults[debtVaultId].borrowedPrincipal[asset];
        uint256 index = debtVaults[debtVaultId].borrowedIndex[asset];
        if (principal == 0) {
            return 0;
        }
        if (index == 0) {
            return principal;
        }

        return (principal * reserve.borrowIndex) / index;
    }

    function getDeltaPrincipal(
        LendingPoolTypes.Reserve storage reserve,
        uint256 prevAmount,
        uint256 currAmount,
        uint256 ray
    ) internal view returns (uint256 deltaPrincipal) {
        uint256 prevPrincipal = principalFromDebtAmount(
            reserve,
            prevAmount,
            ray
        );

        uint256 currPrincipal = principalFromDebtAmount(
            reserve,
            currAmount,
            ray
        );

        deltaPrincipal = prevPrincipal > currPrincipal
            ? prevPrincipal - currPrincipal
            : currPrincipal - prevPrincipal;
    }

    function principalFromDebtAmount(
        LendingPoolTypes.Reserve storage reserve,
        uint256 amount,
        uint256 ray
    ) internal view returns (uint256) {
        return (amount * ray) / reserve.borrowIndex;
    }

    function debtAmountFromPrincipal(
        LendingPoolTypes.Reserve storage reserve,
        uint256 principal,
        uint256 ray
    ) external view returns (uint256) {
        return (principal * reserve.borrowIndex) / ray;
    }

    function sharesFromAssetAmount(
        LendingPoolTypes.Reserve storage reserve,
        uint256 amount,
        uint256 ray
    ) external view returns (uint256) {
        return (amount * ray) / reserve.liquidityIndex;
    }

    function sharesFromAssetAmountRoundUp(
        LendingPoolTypes.Reserve storage reserve,
        uint256 amount,
        uint256 ray
    ) external view returns (uint256) {
        return
            (amount * ray + reserve.liquidityIndex - 1) /
            reserve.liquidityIndex;
    }

    function assetAmountFromShares(
        LendingPoolTypes.Reserve storage reserve,
        uint256 shares,
        uint256 ray
    ) external view returns (uint256) {
        return (shares * reserve.liquidityIndex) / ray;
    }
}
