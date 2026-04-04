// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {LendingPoolTypes} from "../types/LendingPoolTypes.sol";
import {ReserveLogic} from "./ReserveLogic.sol";
import {SimpleOracle} from "../Oracle.sol";

library DebtVaultLogic {
  function requireDebtWithinLimits(
    mapping(uint256 => LendingPoolTypes.DebtVault) storage debtVaults,
    mapping(uint256 => address[]) storage debtVaultCollateralAssets,
    mapping(uint256 => address[]) storage borrowedAssetsInDebtVault,
    mapping(address => LendingPoolTypes.Reserve) storage reserves,
    SimpleOracle oracle,
    uint256 debtVaultId,
    uint256 ray
  ) external view {
    (uint256 maxBorrowableValue,, uint256 debtValue) = getDebtVaultValues(
      debtVaults,
      debtVaultCollateralAssets,
      borrowedAssetsInDebtVault,
      reserves,
      oracle,
      debtVaultId,
      ray
    );
    require(debtValue <= maxBorrowableValue, "LendingPool: insufficient collateral");
  }

  function getLiquidationShares(
    mapping(address => LendingPoolTypes.Reserve) storage reserves,
    SimpleOracle oracle,
    uint256 repayAmount,
    address debtAsset,
    address collateralAsset,
    uint256 liquidationBonus,
    uint256 bps,
    uint256 ray
  ) external view returns (uint256) {
    uint256 debtPrice = oracle.getPrice(debtAsset);
    uint256 collateralPrice = oracle.getPrice(collateralAsset);
    uint256 repayValue = (repayAmount * debtPrice) / ray;
    uint256 liquidatingValue = (repayValue * (bps + liquidationBonus)) / bps;
    uint256 collateralAmount = (liquidatingValue * ray) / collateralPrice;

    return ReserveLogic.sharesFromAssetAmountRoundUp(reserves[collateralAsset], collateralAmount, ray);
  }

  function getActualLiquidationTransferredShares(
    LendingPoolTypes.DebtVault storage debtVault,
    mapping(address => mapping(address => uint256)) storage lockedShares,
    address collateralAsset,
    uint256 requestedShares
  ) external view returns (uint256 actualTransferredShares) {
    uint256 lockedShare = lockedShares[debtVault.borrower][collateralAsset];
    uint256 availableShare = debtVault.collateralShares[collateralAsset];

    require(lockedShare > 0, "LendingPool: no shares"); 
    require(availableShare > 0, "LendingPool: no collateral");

    actualTransferredShares = availableShare < requestedShares ? availableShare : requestedShares;
    actualTransferredShares = lockedShare < actualTransferredShares ? lockedShare : actualTransferredShares;
  }

  function getDebtVaultValues(
    mapping(uint256 => LendingPoolTypes.DebtVault) storage debtVaults,
    mapping(uint256 => address[]) storage debtVaultCollateralAssets,
    mapping(uint256 => address[]) storage borrowedAssetsInDebtVault,
    mapping(address => LendingPoolTypes.Reserve) storage reserves,
    SimpleOracle oracle,
    uint256 debtVaultId,
    uint256 ray
  ) internal view returns (uint256 maxBorrowableValue, uint256 liquidationThresholdValue, uint256 debtValue) {
    LendingPoolTypes.DebtVault storage debtVault = debtVaults[debtVaultId];

    // collateral info
    address[] storage collateralAssets = debtVaultCollateralAssets[debtVaultId];
    for (uint256 i = 0; i < collateralAssets.length; i++) {
      address asset = collateralAssets[i];
      uint256 shares = debtVault.collateralShares[asset];
      if (shares == 0) {
        continue;
      }

      LendingPoolTypes.Reserve storage reserve = reserves[asset];
      uint256 amount = ReserveLogic.assetAmountFromShares(reserve, shares, ray);
      uint256 value = (amount * oracle.getPrice(asset)) / ray;

      maxBorrowableValue += (value * reserve.ltv) / ray;
      liquidationThresholdValue += (value * reserve.liquidationThreshold) / ray;
    }

    // debt info
    address[] storage borrowedAssets = borrowedAssetsInDebtVault[debtVaultId];
    for (uint256 i = 0; i < borrowedAssets.length; i++) {
      address asset = borrowedAssets[i];
      uint256 principal = debtVault.borrowedPrincipal[asset];
      if (principal == 0) {
        continue;
      }

      LendingPoolTypes.Reserve storage reserve = reserves[asset];
      uint256 index = debtVault.borrowedIndex[asset];
      uint256 amount = index == 0 ? principal : (principal * reserve.borrowIndex) / index;
      debtValue += (amount * oracle.getPrice(asset)) / ray;
    }
  }
}
