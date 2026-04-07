// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {AToken} from "../AToken.sol";
import {InterestRateModel} from "../InterestRate.sol";

library LendingPoolTypes {
    struct AddReserveParams {
        address asset;
        address interestRateModel;
        bool canBeCollateral;
        bool canBeBorrowed;
        uint256 ltv;
        uint256 liquidationThreshold;
        string aTokenName;
        string aTokenSymbol;
    }

    struct LiquidationParams {
        uint256 debtVaultId;
        address debtAsset;
        address collateralAsset;
        uint256 repayAmount;
        uint256 liquidationBonus;
        uint256 closeFactor;
        uint256 bps;
        uint256 ray;
        address liquidator;
    }

    struct Reserve {
        bool enabled;
        bool canBeCollateral;
        bool canBeBorrowed;
        uint256 ltv;
        uint256 liquidationThreshold;
        uint256 totalBorrows;
        uint256 borrowIndex;
        uint256 liquidityIndex;
        uint256 lastAccrualBlock;
        AToken aToken;
        InterestRateModel interestRateModel;
    }

    struct DebtVault {
        address borrower;
        mapping(address => uint256) collateralShares;
        mapping(address => uint256) borrowedPrincipal;
        mapping(address => uint256) borrowedIndex;
        uint256 healthFactor;
        bool active;
    }
}
