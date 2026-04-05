// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {LendingPoolTypes} from "../types/LendingPoolTypes.sol";
import {ReserveLogic} from "./ReserveLogic.sol";
import {DebtVaultLogic} from "./DebtVaultLogic.sol";

library BorrowLogic {
    using SafeERC20 for IERC20;

    event DebtVaultOpened(uint256 indexed debtVaultId, address indexed owner);

    function executeOpenDebtVault(
        mapping(uint256 => LendingPoolTypes.DebtVault) storage debtVaults,
        mapping(address => uint256[]) storage ownerDebtVaultIds,
        uint256 nextDebtVaultId,
        address user
    ) external returns (uint256 debtVaultId) {
        debtVaultId = nextDebtVaultId;
        LendingPoolTypes.DebtVault storage debtVault = debtVaults[debtVaultId];
        debtVault.borrower = user;
        debtVault.active = true;
        debtVault.healthFactor = type(uint256).max;
        ownerDebtVaultIds[user].push(debtVaultId);

        emit DebtVaultOpened(debtVaultId, user);
    }

    function executeBorrow(
        mapping(address => LendingPoolTypes.Reserve) storage reserves,
        mapping(uint256 => LendingPoolTypes.DebtVault) storage debtVaults,
        mapping(uint256 => address[]) storage borrowedAssetsInDebtVault,
        mapping(uint256 => mapping(address => bool)) storage isBorrowedAssetInDebtVault,
        uint256 debtVaultId,
        address asset,
        uint256 amount,
        uint256 assetCash
    ) external {
        require(amount > 0, "LendingPool: amount=0");
        LendingPoolTypes.Reserve storage reserve = reserves[asset];
        require(reserve.canBeBorrowed, "LendingPool: borrow disabled");
        require(assetCash >= amount, "LendingPool: insufficient liquidity");

        LendingPoolTypes.DebtVault storage debtVault = debtVaults[debtVaultId];

        reserve.totalBorrows += amount;
        debtVault.borrowedIndex[asset] = reserve.borrowIndex;
        debtVault.borrowedPrincipal[asset] +=
            amount /
            debtVault.borrowedIndex[asset];

        if (!isBorrowedAssetInDebtVault[debtVaultId][asset]) {
            isBorrowedAssetInDebtVault[debtVaultId][asset] = true;
            borrowedAssetsInDebtVault[debtVaultId].push(asset);
        }
    }

    function executeRepay(
        mapping(address => LendingPoolTypes.Reserve) storage reserves,
        mapping(uint256 => LendingPoolTypes.DebtVault) storage debtVaults,
        uint256 debtVaultId,
        address asset,
        uint256 amount
    ) external returns (uint256 repayAmount) {
        require(amount > 0, "LendingPool: amount=0");
        LendingPoolTypes.Reserve storage reserve = reserves[asset];
        LendingPoolTypes.DebtVault storage debtVault = debtVaults[debtVaultId];

        uint256 currentDebt = ReserveLogic.borrowBalance(
            debtVaults,
            debtVaultId,
            asset,
            reserve
        );
        require(currentDebt > 0, "LendingPool: no debt");

        repayAmount = amount > currentDebt ? currentDebt : amount;

        reserve.totalBorrows -= repayAmount;
        debtVault.borrowedPrincipal[asset] = currentDebt - repayAmount;
        debtVault.borrowedIndex[asset] = reserve.borrowIndex;
    }
}
