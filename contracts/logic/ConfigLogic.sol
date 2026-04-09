// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {AToken} from "../AToken.sol";
import {InterestRateModel} from "../InterestRate.sol";
import {LendingPoolTypes} from "../types/LendingPoolTypes.sol";

library ConfigLogic {
    event ReserveAdded(
        address indexed asset,
        address indexed aToken,
        address indexed interestRateModel
    );

    function executeAddReserve(
        mapping(address => LendingPoolTypes.Reserve) storage reserves,
        mapping(address => bool) storage isReserveAsset,
        address[] storage reserveAssetList,
        LendingPoolTypes.AddReserveParams memory params,
        uint256 ray,
        address owner,
        address pool
    ) external returns (address aTokenAddress) {
        require(params.asset != address(0), "LendingPool: bad asset");
        require(
            params.interestRateModel != address(0),
            "LendingPool: bad interest rate model"
        );
        require(!isReserveAsset[params.asset], "LendingPool: reserve exists");
        require(
            params.liquidationThreshold <= ray,
            "LendingPool: bad threshold"
        );
        require(
            params.ltv <= params.liquidationThreshold,
            "LendingPool: ltv > threshold"
        );

        AToken aToken = new AToken(
            params.aTokenName,
            params.aTokenSymbol,
            owner,
            pool
        );
        LendingPoolTypes.Reserve storage reserve = reserves[params.asset];
        reserve.enabled = true;
        reserve.canBeCollateral = params.canBeCollateral;
        reserve.canBeBorrowed = params.canBeBorrowed;
        reserve.ltv = params.ltv;
        reserve.liquidationThreshold = params.liquidationThreshold;
        reserve.totalBorrows = 0;
        reserve.totalDebtPrincipal = 0;
        reserve.borrowIndex = ray;
        reserve.liquidityIndex = ray;
        reserve.lastAccrualBlock = block.number;
        reserve.aToken = aToken;
        reserve.interestRateModel = InterestRateModel(params.interestRateModel);

        isReserveAsset[params.asset] = true;
        reserveAssetList.push(params.asset);

        emit ReserveAdded(
            params.asset,
            address(aToken),
            params.interestRateModel
        );

        return address(aToken);
    }
}
