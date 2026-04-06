// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {LendingPoolTypes} from "../types/LendingPoolTypes.sol";
import {SimpleOracle} from "../Oracle.sol";
import {DebtVaultLogic} from "./DebtVaultLogic.sol";
import {ReserveLogic} from "./ReserveLogic.sol";

library LiquidationLogic {
    using SafeERC20 for IERC20;

    event LiquidationExecuted(
        address indexed liquidator,
        uint256 indexed debtVaultId,
        address indexed debtAsset,
        address collateralAsset,
        uint256 debtRepaid,
        uint256 collateralSharesSeized
    );

    function executeLiquidation(
        mapping(address => LendingPoolTypes.Reserve) storage reserves,
        mapping(uint256 => LendingPoolTypes.DebtVault) storage debtVaults,
        mapping(address => mapping(address => uint256)) storage custodiedShares,
        mapping(address => mapping(address => uint256)) storage lockedShares,
        SimpleOracle oracle,
        LendingPoolTypes.LiquidationParams memory params
    )
        internal
        returns (uint256 actualRepayAmount, uint256 actualTransferredShares)
    {
        require(params.repayAmount > 0, "LendingPool: amount=0");

        LendingPoolTypes.DebtVault storage debtVault = debtVaults[
            params.debtVaultId
        ];
        LendingPoolTypes.Reserve storage debtReserve = reserves[
            params.debtAsset
        ];
        require(debtReserve.enabled, "LendingPool: debtReserve missing");
        require(
            reserves[params.collateralAsset].enabled,
            "LendingPool: collateralAsset missing"
        );

        // liquidator actual repay
        uint256 principal = ReserveLogic.borrowBalance(
            debtVaults,
            params.debtVaultId,
            params.debtAsset,
            debtReserve
        );
        require(principal > 0, "LendingPool: no debt");
        actualRepayAmount  = (principal * params.closeFactor) / params.bps;// max allowed RepayAmount
        actualRepayAmount = params.repayAmount > actualRepayAmount // min(maxRepayAmount, request repayAmount)
            ? actualRepayAmount
            : params.repayAmount;

        // liquidator actual earn
        uint256 requestedShares = DebtVaultLogic.getLiquidationShares(
            reserves,
            oracle,
            actualRepayAmount,
            params.debtAsset,
            params.collateralAsset,
            params.liquidationBonus,
            params.bps,
            params.ray
        );

        actualTransferredShares = DebtVaultLogic
            .getActualLiquidationTransferredShares(
                debtVault,
                lockedShares,
                params.collateralAsset,
                requestedShares
            );

        // interact
        debtReserve.totalBorrows -= actualRepayAmount;
        debtVault.borrowedPrincipal[params.debtAsset] =
            (principal - actualRepayAmount) /
            debtVault.borrowedIndex[params.debtAsset];
        debtVault.collateralShares[
            params.collateralAsset
        ] -= actualTransferredShares;
        lockedShares[debtVault.borrower][
            params.collateralAsset
        ] -= actualTransferredShares;
        custodiedShares[debtVault.borrower][
            params.collateralAsset
        ] -= actualTransferredShares;
        custodiedShares[params.liquidator][
            params.collateralAsset
        ] += actualTransferredShares;

        IERC20(params.debtAsset).safeTransferFrom(
            params.liquidator,
            address(this),
            actualRepayAmount
        );

        emit LiquidationExecuted(
            params.liquidator,
            params.debtVaultId,
            params.debtAsset,
            params.collateralAsset,
            actualRepayAmount,
            actualTransferredShares
        );
    }
}
