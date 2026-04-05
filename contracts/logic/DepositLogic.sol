// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {LendingPoolTypes} from "../types/LendingPoolTypes.sol";
import {ReserveLogic} from "./ReserveLogic.sol";

library DepositLogic {
    using SafeERC20 for IERC20;

    event Deposit(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 shares
    );
    event Withdraw(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 shares
    );
    event ClaimAToken(
        address indexed user,
        address indexed asset,
        address indexed to,
        uint256 shares
    );
    event RecustodyAToken(
        address indexed user,
        address indexed asset,
        uint256 shares
    );
    event CollateralDeposited(
        uint256 indexed debtVaultId,
        address indexed asset,
        uint256 amount,
        uint256 shares
    );

    function executeDeposit(
        mapping(address => LendingPoolTypes.Reserve) storage reserves,
        mapping(address => mapping(address => uint256)) storage custodiedShares,
        address asset,
        uint256 amount,
        address user,
        uint256 ray
    ) external returns (uint256 shares) {
        require(amount > 0, "LendingPool: amount=0");
        LendingPoolTypes.Reserve storage reserve = reserves[asset];

        IERC20(asset).safeTransferFrom(user, address(this), amount);
        shares = ReserveLogic.sharesFromAssetAmount(reserve, amount, ray);
        require(shares > 0, "LendingPool: shares=0");

        reserve.aToken.mint(address(this), shares);
        custodiedShares[user][asset] += shares;

        emit Deposit(user, asset, amount, shares);
    }

    function executeWithdraw(
        mapping(address => LendingPoolTypes.Reserve) storage reserves,
        mapping(address => mapping(address => uint256)) storage custodiedShares,
        mapping(address => mapping(address => uint256)) storage lockedShares,
        address asset,
        uint256 amount,
        address user,
        uint256 assetCash,
        uint256 ray
    ) external returns (uint256 shares) {
        require(amount > 0, "LendingPool: amount=0");
        LendingPoolTypes.Reserve storage reserve = reserves[asset];

        shares = ReserveLogic.sharesFromAssetAmountRoundUp(
            reserve,
            amount,
            ray
        );
        require(shares > 0, "LendingPool: shares=0");
        require(
            custodiedShares[user][asset] - lockedShares[user][asset] >= shares,
            "LendingPool: insufficient claimable shares"
        );
        require(assetCash >= amount, "LendingPool: insufficient liquidity");

        custodiedShares[user][asset] -= shares;
        reserve.aToken.burn(address(this), shares);
        IERC20(asset).safeTransfer(user, amount);

        emit Withdraw(user, asset, amount, shares);
    }

    function executeClaimAToken(
        mapping(address => LendingPoolTypes.Reserve) storage reserves,
        mapping(address => mapping(address => uint256)) storage custodiedShares,
        mapping(address => mapping(address => uint256)) storage lockedShares,
        address asset,
        uint256 shares,
        address user,
        address to
    ) external {
        require(shares > 0, "LendingPool: shares=0");
        require(to != address(0), "LendingPool: bad to");
        require(
            custodiedShares[user][asset] - lockedShares[user][asset] >= shares,
            "LendingPool: insufficient claimable shares"
        );

        LendingPoolTypes.Reserve storage reserve = reserves[asset];
        custodiedShares[user][asset] -= shares;
        require(
            reserve.aToken.transfer(to, shares),
            "LendingPool: aToken transfer failed"
        );

        emit ClaimAToken(user, asset, to, shares);
    }

    function executeRecustodyAToken(
        mapping(address => LendingPoolTypes.Reserve) storage reserves,
        mapping(address => mapping(address => uint256)) storage custodiedShares,
        address asset,
        uint256 shares,
        address user
    ) external {
        require(shares > 0, "LendingPool: shares=0");
        LendingPoolTypes.Reserve storage reserve = reserves[asset];

        IERC20(address(reserve.aToken)).safeTransferFrom(
            user,
            address(this),
            shares
        );
        custodiedShares[user][asset] += shares;

        emit RecustodyAToken(user, asset, shares);
    }

    function executeDepositCollateral(
        mapping(address => LendingPoolTypes.Reserve) storage reserves,
        mapping(uint256 => LendingPoolTypes.DebtVault) storage debtVaults,
        mapping(uint256 => address[]) storage debtVaultCollateralAssets,
        mapping(uint256 => mapping(address => bool)) storage debtVaultHasCollateralAsset,
        mapping(address => mapping(address => uint256)) storage custodiedShares,
        mapping(address => mapping(address => uint256)) storage lockedShares,
        uint256 debtVaultId,
        address asset,
        uint256 amount,
        address user,
        uint256 ray
    ) external returns (uint256 shares) {
        require(amount > 0, "LendingPool: amount=0");
        LendingPoolTypes.Reserve storage reserve = reserves[asset];
        require(reserve.canBeCollateral, "LendingPool: collateral disabled");

        shares = ReserveLogic.sharesFromAssetAmount(reserve, amount, ray);
        require(shares > 0, "LendingPool: shares=0");
        require(
            custodiedShares[user][asset] - lockedShares[user][asset] >= shares,
            "LendingPool: insufficient claimable shares"
        );

        lockedShares[user][asset] += shares;
        debtVaults[debtVaultId].collateralShares[asset] += shares;

        if (!debtVaultHasCollateralAsset[debtVaultId][asset]) {
            debtVaultHasCollateralAsset[debtVaultId][asset] = true;
            debtVaultCollateralAssets[debtVaultId].push(asset);
        }

        emit CollateralDeposited(debtVaultId, asset, amount, shares);
    }

    function validateWithdrawCollateral(
        mapping(address => LendingPoolTypes.Reserve) storage reserves,
        mapping(uint256 => LendingPoolTypes.DebtVault) storage debtVaults,
        mapping(address => mapping(address => uint256)) storage lockedShares,
        uint256 debtVaultId,
        address asset,
        uint256 amount,
        address user,
        uint256 ray
    ) external view returns (uint256 shares) {
        require(amount > 0, "LendingPool: amount=0");
        LendingPoolTypes.Reserve storage reserve = reserves[asset];

        shares = ReserveLogic.sharesFromAssetAmountRoundUp(
            reserve,
            amount,
            ray
        );
        require(shares > 0, "LendingPool: shares=0");

        LendingPoolTypes.DebtVault storage debtVault = debtVaults[debtVaultId];
        require(debtVault.borrower == user, "LendingPool: not vault owner");
        require(debtVault.active, "LendingPool: inactive vault");

        require(
            lockedShares[user][asset] >= debtVault.collateralShares[asset],
            "LendingPool: insufficient locked shares"
        );
        require(
            debtVault.collateralShares[asset] >= shares,
            "LendingPool: insufficient collateral"
        );
    }
}
