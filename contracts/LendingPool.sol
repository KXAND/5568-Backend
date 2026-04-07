// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {PoolCoin} from "./PoolCoin.sol";
import {InterestRateModel} from "./InterestRate.sol";
import {SimpleOracle} from "./Oracle.sol";
import {LendingPoolTypes} from "./types/LendingPoolTypes.sol";
import {ReserveLogic} from "./logic/ReserveLogic.sol";
import {DebtVaultLogic} from "./logic/DebtVaultLogic.sol";
import {ConfigLogic} from "./logic/ConfigLogic.sol";
import {DepositLogic} from "./logic/DepositLogic.sol";
import {BorrowLogic} from "./logic/BorrowLogic.sol";
import {LiquidationLogic} from "./logic/LiquidationLogic.sol";

contract LendingPool is Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant RAY = 1e18;
    uint256 public constant BPS = 10_000;

    SimpleOracle public oracle;
    uint256 public liquidationBonus = 500;
    uint256 public closeFactor = 5000;
    uint256 public nextDebtVaultId = 1;

    mapping(address => LendingPoolTypes.Reserve) public reserves;
    address[] private reserveAssetList;
    mapping(address => bool) public isReserveAsset;

    mapping(uint256 => LendingPoolTypes.DebtVault) private debtVaults;
    mapping(uint256 => address[]) private debtVaultCollateralAssets;
    mapping(uint256 => address[]) private borrowedAssetsInDebtVault;
    mapping(uint256 => mapping(address => bool))
        private debtVaultHasCollateralAsset;
    mapping(uint256 => mapping(address => bool))
        private isBorrowedAssetInDebtVault;
    mapping(address => uint256[]) private ownerDebtVaultIds;

    mapping(address => mapping(address => uint256)) private custodiedShares;
    mapping(address => mapping(address => uint256)) private lockedShares;
    event ReserveConfigUpdated(
        address indexed asset,
        bool canBeCollateral,
        bool canBeBorrowed,
        uint256 ltv,
        uint256 liquidationThreshold
    );
    event SetInterestRateModel(address indexed asset, address indexed newModel);
    event SetOracle(address newOracle);
    event SetLiquidationBonus(uint256 bonus);
    event FundReserve(address indexed asset, uint256 amount);
    event Borrow(
        address indexed user,
        uint256 indexed debtVaultId,
        address indexed asset,
        uint256 amount
    );
    event Repay(
        address indexed user,
        uint256 indexed debtVaultId,
        address indexed asset,
        uint256 amount
    );
    event CollateralWithdrawn(
        uint256 indexed debtVaultId,
        address indexed asset,
        uint256 amount,
        uint256 shares
    );

    constructor(address _oracle) Ownable(msg.sender) {
        require(_oracle != address(0), "LendingPool: bad oracle");
        oracle = SimpleOracle(_oracle);
    }

    function addReserve(
        address asset,
        address interestRateModel,
        bool canBeCollateral,
        bool canBeBorrowed,
        uint256 ltv,
        uint256 liquidationThreshold,
        string calldata aTokenName,
        string calldata aTokenSymbol
    ) external onlyOwner {
        LendingPoolTypes.AddReserveParams memory params = LendingPoolTypes
            .AddReserveParams({
                asset: asset,
                interestRateModel: interestRateModel,
                canBeCollateral: canBeCollateral,
                canBeBorrowed: canBeBorrowed,
                ltv: ltv,
                liquidationThreshold: liquidationThreshold,
                aTokenName: aTokenName,
                aTokenSymbol: aTokenSymbol
            });

        ConfigLogic.executeAddReserve(
            reserves,
            isReserveAsset,
            reserveAssetList,
            params,
            RAY,
            msg.sender,
            address(this)
        );
    }

    function setReserveConfig(
        address asset,
        bool canBeCollateral,
        bool canBeBorrowed,
        uint256 ltv,
        uint256 liquidationThreshold
    ) external onlyOwner {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        require(liquidationThreshold <= RAY, "LendingPool: bad threshold");
        require(ltv <= liquidationThreshold, "LendingPool: ltv > threshold");

        reserve.canBeCollateral = canBeCollateral;
        reserve.canBeBorrowed = canBeBorrowed;
        reserve.ltv = ltv;
        reserve.liquidationThreshold = liquidationThreshold;

        emit ReserveConfigUpdated(
            asset,
            canBeCollateral,
            canBeBorrowed,
            ltv,
            liquidationThreshold
        );
    }

    function setOracle(address newOracle) external onlyOwner {
        oracle = SimpleOracle(newOracle);
        emit SetOracle(newOracle);
    }

    function setInterestRateModel(
        address asset,
        address newModel
    ) external onlyOwner {
        require(newModel != address(0), "LendingPool: bad model");
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        reserve.interestRateModel = InterestRateModel(newModel);
        emit SetInterestRateModel(asset, newModel);
    }

    // 清算配置函数
    function setLiquidationBonus(uint256 _bonus) external onlyOwner {
        require(_bonus <= 3000, "Bonus too high");
        liquidationBonus = _bonus;
        emit SetLiquidationBonus(_bonus);
    }

    function setCloseFactor(uint256 _closeFactor) external onlyOwner {
        require(_closeFactor <= BPS, "closeFactor too high");
        closeFactor = _closeFactor;
    }

    function liquidate(
        uint256 debtVaultId,
        address debtAsset,
        address collateralAsset,
        uint256 repayAmount
    ) external {
        LendingPoolTypes.Reserve storage debtReserve = _getReserve(debtAsset);
        LendingPoolTypes.Reserve storage collateralReserve = _getReserve(
            collateralAsset
        );
        _accrueInterest(debtAsset, debtReserve);
        _accrueInterest(collateralAsset, collateralReserve);

        require(healthFactor(debtVaultId) < RAY, "LendingPool: healthy");

        LendingPoolTypes.LiquidationParams memory params = LendingPoolTypes
            .LiquidationParams({
                debtVaultId: debtVaultId,
                debtAsset: debtAsset,
                collateralAsset: collateralAsset,
                repayAmount: repayAmount,
                liquidationBonus: liquidationBonus,
                closeFactor: closeFactor,
                bps: BPS,
                ray: RAY,
                liquidator: msg.sender
            });

        LiquidationLogic.executeLiquidation(
            reserves,
            debtVaults,
            custodiedShares,
            lockedShares,
            oracle,
            params
        );

        _updateDebtVaultHealthFactor(debtVaultId);
    }

    function deposit(address asset, uint256 amount) external {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        _accrueInterest(asset, reserve);
        DepositLogic.executeDeposit(
            reserves,
            custodiedShares,
            asset,
            amount,
            msg.sender,
            RAY
        );
    }

    function withdraw(address asset, uint256 amount) external {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        _accrueInterest(asset, reserve);
        DepositLogic.executeWithdraw(
            reserves,
            custodiedShares,
            lockedShares,
            asset,
            amount,
            msg.sender,
            _availableLiquidity(asset),
            RAY
        );
    }

    function claimAToken(address asset, uint256 shares, address to) external {
        DepositLogic.executeClaimAToken(
            reserves,
            custodiedShares,
            lockedShares,
            asset,
            shares,
            msg.sender,
            to
        );
    }

    function recustodyAToken(address asset, uint256 shares) external {
        DepositLogic.executeRecustodyAToken(
            reserves,
            custodiedShares,
            asset,
            shares,
            msg.sender
        );
    }

    function fundReserve(address asset, uint256 amount) external onlyOwner {
        require(amount > 0, "LendingPool: amount=0");
        require(reserves[asset].enabled, "LendingPool: reserve missing");
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit FundReserve(asset, amount);
    }

    function openDebtVault() external returns (uint256 debtVaultId) {
        debtVaultId = BorrowLogic.executeOpenDebtVault(
            debtVaults,
            ownerDebtVaultIds,
            nextDebtVaultId,
            msg.sender
        );
        nextDebtVaultId += 1;
    }

    function depositCollateral(
        uint256 debtVaultId,
        address asset,
        uint256 amount
    ) external {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        _accrueInterest(asset, reserve);
        DepositLogic.executeDepositCollateral(
            reserves,
            debtVaults,
            debtVaultCollateralAssets,
            debtVaultHasCollateralAsset,
            custodiedShares,
            lockedShares,
            debtVaultId,
            asset,
            amount,
            msg.sender,
            RAY
        );
        _updateDebtVaultHealthFactor(debtVaultId);
    }

    function withdrawCollateral(
        uint256 debtVaultId,
        address asset,
        uint256 amount
    ) external {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        _accrueInterest(asset, reserve);
        uint256 shares = DepositLogic.validateWithdrawCollateral(
            reserves,
            debtVaults,
            lockedShares,
            debtVaultId,
            asset,
            amount,
            msg.sender,
            RAY
        );

        DebtVaultLogic.requireDebtWithinLimits(
            debtVaults,
            debtVaultCollateralAssets,
            borrowedAssetsInDebtVault,
            reserves,
            oracle,
            debtVaultId,
            RAY
        );

        debtVaults[debtVaultId].collateralShares[asset] -= shares;
        lockedShares[msg.sender][asset] -= shares;

        _updateDebtVaultHealthFactor(debtVaultId);
        emit CollateralWithdrawn(debtVaultId, asset, amount, shares);
    }

    function borrow(
        uint256 debtVaultId,
        address asset,
        uint256 amount
    ) external {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        _accrueInterest(asset, reserve);
        BorrowLogic.executeBorrow(
            reserves,
            debtVaults,
            borrowedAssetsInDebtVault,
            isBorrowedAssetInDebtVault,
            debtVaultId,
            asset,
            amount,
            _availableLiquidity(asset)
        );
        DebtVaultLogic.requireDebtWithinLimits(
            debtVaults,
            debtVaultCollateralAssets,
            borrowedAssetsInDebtVault,
            reserves,
            oracle,
            debtVaultId,
            RAY
        );

        _updateDebtVaultHealthFactor(debtVaultId);

        IERC20(asset).safeTransfer(msg.sender, amount);
        emit Borrow(msg.sender, debtVaultId, asset, amount);
    }

    function repay(
        uint256 debtVaultId,
        address asset,
        uint256 amount
    ) external {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        _accrueInterest(asset, reserve);
        uint256 repayAmount = BorrowLogic.executeRepay(
            reserves,
            debtVaults,
            debtVaultId,
            asset,
            amount
        );
        _updateDebtVaultHealthFactor(debtVaultId);

        IERC20(asset).safeTransferFrom(msg.sender, address(this), repayAmount);
        emit Repay(msg.sender, debtVaultId, asset, repayAmount);
    }

    function getReserveAToken(address asset) external view returns (address) {
        return address(_getReserve(asset).aToken);
    }

    function getReserveAssets() external view returns (address[] memory) {
        return reserveAssetList;
    }

    function getReserveUtilization(
        address asset
    ) external view returns (uint256) {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        return
            ReserveLogic.getUtilization(
                reserve,
                _availableLiquidity(asset),
                RAY
            );
    }

    function getOwnerDebtVaultIds(
        address owner_
    ) external view returns (uint256[] memory) {
        return ownerDebtVaultIds[owner_];
    }

    function healthFactor(uint256 debtVaultId) public view returns (uint256) {
        (
            ,
            uint256 liquidationThresholdValue,
            uint256 debtValue
        ) = DebtVaultLogic.getDebtVaultValues(
                debtVaults,
                debtVaultCollateralAssets,
                borrowedAssetsInDebtVault,
                reserves,
                oracle,
                debtVaultId,
                RAY
            );
        if (debtValue == 0) return type(uint256).max;
        return (liquidationThresholdValue * RAY) / debtValue;
    }

    function getDebtVaultHealthFactor(
        uint256 debtVaultId
    ) external view returns (uint256) {
        return healthFactor(debtVaultId);
    }

    function getDebtVaultValues(
        uint256 debtVaultId
    )
        external
        view
        returns (
            uint256 maxBorrowableValue,
            uint256 liquidationThresholdValue,
            uint256 debtValue
        )
    {
        return
            DebtVaultLogic.getDebtVaultValues(
                debtVaults,
                debtVaultCollateralAssets,
                borrowedAssetsInDebtVault,
                reserves,
                oracle,
                debtVaultId,
                RAY
            );
    }

    function getDebtVaultSummary(
        uint256 debtVaultId
    )
        external
        view
        returns (
            address borrower,
            bool active,
            uint256 hf,
            uint256 liquidationThresholdValue,
            uint256 debtValue,
            uint256 maxBorrowableValue
        )
    {
        LendingPoolTypes.DebtVault storage debtVault = debtVaults[debtVaultId];
        borrower = debtVault.borrower;
        active = debtVault.active;
        hf = healthFactor(debtVaultId);
        (
            maxBorrowableValue,
            liquidationThresholdValue,
            debtValue
        ) = DebtVaultLogic.getDebtVaultValues(
                debtVaults,
                debtVaultCollateralAssets,
                borrowedAssetsInDebtVault,
                reserves,
                oracle,
                debtVaultId,
                RAY
            );
    }

    function getDebtVaultCollateralShares(
        uint256 debtVaultId,
        address asset
    ) external view returns (uint256) {
        return debtVaults[debtVaultId].collateralShares[asset];
    }

    function getDebtVaultCollateralAssetAmount(
        uint256 debtVaultId,
        address asset
    ) external view returns (uint256) {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        return
            ReserveLogic.assetAmountFromShares(
                reserve,
                debtVaults[debtVaultId].collateralShares[asset],
                RAY
            );
    }

    function getDebtVaultDebtAmount(
        uint256 debtVaultId,
        address asset
    ) external view returns (uint256) {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        return
            ReserveLogic.borrowBalance(debtVaults, debtVaultId, asset, reserve);
    }

    function getDebtVaultCollateralAssets(
        uint256 debtVaultId
    ) external view returns (address[] memory) {
        return debtVaultCollateralAssets[debtVaultId];
    }

    function getDebtVaultBorrowedAssets(
        uint256 debtVaultId
    ) external view returns (address[] memory) {
        return borrowedAssetsInDebtVault[debtVaultId];
    }

    function getUserCustodiedShares(
        address user,
        address asset
    ) public view returns (uint256) {
        return custodiedShares[user][asset];
    }

    function getUserLockedShares(
        address user,
        address asset
    ) public view returns (uint256) {
        return lockedShares[user][asset];
    }

    function getUserClaimableShares(
        address user,
        address asset
    ) public view returns (uint256) {
        return custodiedShares[user][asset] - lockedShares[user][asset];
    }

    function getUserDebtBalance(
        address user,
        address asset
    ) external view returns (uint256 totalDebt) {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        uint256[] storage vaultIds = ownerDebtVaultIds[user];
        for (uint256 i = 0; i < vaultIds.length; i++) {
            totalDebt += ReserveLogic.borrowBalance(
                debtVaults,
                vaultIds[i],
                asset,
                reserve
            );
        }
    }

    function _accrueInterest(
        address asset,
        LendingPoolTypes.Reserve storage reserve
    ) internal {
        ReserveLogic.executeAccrueInterest(
            asset,
            reserve,
            _availableLiquidity(asset),
            RAY
        );
    }

    function _availableLiquidity(
        address asset
    ) internal view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function _updateDebtVaultHealthFactor(uint256 debtVaultId) internal {
        debtVaults[debtVaultId].healthFactor = healthFactor(debtVaultId);
    }

    function _getReserve(
        address asset
    ) internal view returns (LendingPoolTypes.Reserve storage reserve) {
        reserve = reserves[asset];
        require(reserve.enabled, "LendingPool: reserve missing");
    }
}
