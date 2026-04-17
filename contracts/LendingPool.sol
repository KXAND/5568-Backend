// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {AToken} from "./AToken.sol";
import {InterestRateModel} from "./InterestRate.sol";
import {SimpleOracle} from "./Oracle.sol";
import {LendingPoolTypes} from "./types/LendingPoolTypes.sol";
import {ReserveLogic} from "./logic/ReserveLogic.sol";
import {DebtVaultLogic} from "./logic/DebtVaultLogic.sol";
import {ConfigLogic} from "./logic/ConfigLogic.sol";
import {DepositLogic} from "./logic/DepositLogic.sol";
import {BorrowLogic} from "./logic/BorrowLogic.sol";
import {LiquidationLogic} from "./logic/LiquidationLogic.sol";
import {
    IPoolIncentivesController
} from "./incentives/PoolIncentivesController.sol";

contract LendingPool is Ownable {
    using SafeERC20 for IERC20;

    // #region Constants And State
    uint256 public constant RAY = 1e18;
    uint256 public constant BPS = 10_000;
    uint256 public constant DEFAULT_RESERVE_FACTOR_BPS = 500;
    uint8 public constant DEPOSIT_REWARD_TYPE = 0;
    uint8 public constant BORROW_REWARD_TYPE = 1;

    SimpleOracle public oracle;
    IPoolIncentivesController public poolIncentivesController;
    address public treasury;
    uint256 public liquidationBonus = 500;
    uint256 private protocolLiquidationBonusCutBps = 1000;
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
    mapping(address => mapping(address => uint256)) private userDebtPrincipal;
    mapping(address => uint256) private reserveFactorBps;
    mapping(address => uint256) private accruedProtocolFees;
    // #endregion

    // #region Events
    event ReserveConfigUpdated(
        address indexed asset,
        bool canBeCollateral,
        bool canBeBorrowed,
        uint256 ltv,
        uint256 liquidationThreshold
    );
    event SetInterestRateModel(address indexed asset, address indexed newModel);
    event SetOracle(address newOracle);
    event SetPoolIncentivesController(address newController);
    event SetTreasury(address newTreasury);
    event SetReserveFactorBps(address indexed asset, uint256 bps);
    event SetProtocolLiquidationCutBps(uint256 bps);
    event SetLiquidationBonus(uint256 bonus);
    event FundReserve(address indexed asset, uint256 amount);
    event ProtocolFeesAccrued(address indexed asset, uint256 amount);
    event ProtocolFeesCollected(
        address indexed asset,
        address indexed to,
        uint256 amount
    );
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

    // #endregion

    // #region Constructor
    constructor(address _oracle) Ownable(msg.sender) {
        require(_oracle != address(0), "LendingPool: bad oracle");
        oracle = SimpleOracle(_oracle);
        treasury = msg.sender;
    }

    // #endregion

    // #region Admin Setters
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
        _addReserve(
            asset,
            interestRateModel,
            canBeCollateral,
            canBeBorrowed,
            ltv,
            liquidationThreshold,
            aTokenName,
            aTokenSymbol,
            DEFAULT_RESERVE_FACTOR_BPS
        );
    }

    function addReserve(
        address asset,
        address interestRateModel,
        bool canBeCollateral,
        bool canBeBorrowed,
        uint256 ltv,
        uint256 liquidationThreshold,
        string calldata aTokenName,
        string calldata aTokenSymbol,
        uint256 reserveFactorBps_
    ) external onlyOwner {
        _addReserve(
            asset,
            interestRateModel,
            canBeCollateral,
            canBeBorrowed,
            ltv,
            liquidationThreshold,
            aTokenName,
            aTokenSymbol,
            reserveFactorBps_
        );
    }

    function _addReserve(
        address asset,
        address interestRateModel,
        bool canBeCollateral,
        bool canBeBorrowed,
        uint256 ltv,
        uint256 liquidationThreshold,
        string calldata aTokenName,
        string calldata aTokenSymbol,
        uint256 reserveFactorBps_
    ) internal {
        require(reserveFactorBps_ <= BPS, "LendingPool: bad reserve factor");

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

        reserveFactorBps[asset] = reserveFactorBps_;
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

    function setPoolIncentivesController(
        address newController
    ) external onlyOwner {
        poolIncentivesController = IPoolIncentivesController(newController);
        emit SetPoolIncentivesController(newController);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "LendingPool: bad treasury");
        treasury = newTreasury;
        emit SetTreasury(newTreasury);
    }

    function setReserveFactorBps(
        address asset,
        uint256 bps_
    ) external onlyOwner {
        _getReserve(asset);
        require(bps_ <= BPS, "LendingPool: bad reserve factor");
        reserveFactorBps[asset] = bps_;
        emit SetReserveFactorBps(asset, bps_);
    }

    function setProtocolLiquidationCutBps(uint256 bps_) external onlyOwner {
        require(bps_ <= BPS, "LendingPool: bad liquidation cut");
        protocolLiquidationBonusCutBps = bps_;
        emit SetProtocolLiquidationCutBps(bps_);
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

    function fundReserve(address asset, uint256 amount) external onlyOwner {
        require(amount > 0, "LendingPool: amount=0");
        require(reserves[asset].enabled, "LendingPool: reserve missing");
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit FundReserve(asset, amount);
    }
    // #endregion

    // #region Liquidation
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
                protocolLiquidationBonusCutBps: protocolLiquidationBonusCutBps,
                closeFactor: closeFactor,
                bps: BPS,
                ray: RAY,
                liquidator: msg.sender,
                treasury: treasury
            });

        LiquidationLogic.executeLiquidation(
            reserves,
            debtVaults,
            custodiedShares,
            lockedShares,
            userDebtPrincipal,
            oracle,
            params
        );

        _updateDebtVaultHealthFactor(debtVaultId);
    }
    // #endregion

    // #region Deposit And Wallet
    function deposit(address asset, uint256 amount) external {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        _accrueInterest(asset, reserve);
        _handleRewardAction(
            msg.sender,
            asset,
            DEPOSIT_REWARD_TYPE,
            reserve.aToken.totalSupply(),
            custodiedShares[msg.sender][asset]
        );
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
        _handleRewardAction(
            msg.sender,
            asset,
            DEPOSIT_REWARD_TYPE,
            reserve.aToken.totalSupply(),
            getUserCustodiedShares(msg.sender, asset)
        );
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
    // #endregion

    // #region DebtVault Lifecycle
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
    // #endregion

    // #region Borrow And Repay
    function borrow(
        uint256 debtVaultId,
        address asset,
        uint256 amount
    ) external {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        _accrueInterest(asset, reserve);
        address borrower = debtVaults[debtVaultId].borrower;
        _handleRewardAction(
            borrower,
            asset,
            BORROW_REWARD_TYPE,
            reserve.totalDebtPrincipal,
            userDebtPrincipal[borrower][asset]
        );
        BorrowLogic.executeBorrow(
            reserves,
            debtVaults,
            borrowedAssetsInDebtVault,
            isBorrowedAssetInDebtVault,
            userDebtPrincipal,
            debtVaultId,
            asset,
            amount,
            _availableLiquidity(asset),
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
        address borrower = debtVaults[debtVaultId].borrower;
        _handleRewardAction(
            borrower,
            asset,
            BORROW_REWARD_TYPE,
            reserve.totalDebtPrincipal,
            this.getUserDebtPrincipal(borrower, asset)
        );
        uint256 repayAmount = BorrowLogic.executeRepay(
            reserves,
            debtVaults,
            userDebtPrincipal,
            debtVaultId,
            asset,
            amount,
            RAY
        );
        _updateDebtVaultHealthFactor(debtVaultId);

        IERC20(asset).safeTransferFrom(msg.sender, address(this), repayAmount);
        emit Repay(msg.sender, debtVaultId, asset, repayAmount);
    }
    // #endregion

    // #region Protocol Fee
    function getReserveFactorBps(
        address asset
    ) external view returns (uint256) {
        _getReserve(asset);
        return reserveFactorBps[asset];
    }

    function getAccruedProtocolFees(
        address asset
    ) external view returns (uint256) {
        _getReserve(asset);
        return accruedProtocolFees[asset];
    }

    function getProtocolLiquidationCutBps() external view returns (uint256) {
        return protocolLiquidationBonusCutBps;
    }

    function collectProtocolFees(
        address asset,
        uint256 amount,
        address to
    ) external onlyOwner {
        _getReserve(asset);
        require(to != address(0), "LendingPool: bad to");
        require(amount > 0, "LendingPool: amount=0");
        require(
            accruedProtocolFees[asset] >= amount,
            "LendingPool: insufficient protocol fees"
        );
        require(
            _availableLiquidity(asset) >= amount,
            "LendingPool: insufficient liquidity"
        );

        accruedProtocolFees[asset] -= amount;
        IERC20(asset).safeTransfer(to, amount);

        emit ProtocolFeesCollected(asset, to, amount);
    }
    // #endregion

    // #region Reserve Getters
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

    struct LiquidationTable {
        uint256 debtVaultId;
        address borrower;
        uint256 healthFactor;
        uint256 debtValue;
        uint256 collateralValue;
    }

    function getLiquidationTables()
        external
        view
        returns (LiquidationTable[] memory)
    {
        uint256 totalCount = nextDebtVaultId - 1;
        uint256[] memory candidateIds = new uint256[](totalCount);
        uint256 candidateCount = 0;

        for (uint256 i = 1; i < nextDebtVaultId; i++) {
            if (debtVaults[i].active && healthFactor(i) < RAY) {
                candidateIds[candidateCount] = i;
                candidateCount++;
            }
        }

        LiquidationTable[] memory candidates = new LiquidationTable[](
            candidateCount
        );
        for (uint256 i = 0; i < candidateCount; i++) {
            uint256 vaultId = candidateIds[i];
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
                    vaultId,
                    RAY
                );
            candidates[i] = LiquidationTable({
                debtVaultId: vaultId,
                borrower: debtVaults[vaultId].borrower,
                healthFactor: healthFactor(vaultId),
                debtValue: debtValue,
                collateralValue: liquidationThresholdValue
            });
        }
        return candidates;
    }

    // #endregion

    // #region DebtVault Getters
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

    // #endregion

    // #region User Getters
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

    function getUserCustodiedAssetAmount(
        address user,
        address asset
    ) external view returns (uint256) {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        return
            ReserveLogic.assetAmountFromShares(
                reserve,
                custodiedShares[user][asset],
                RAY
            );
    }

    function getUserLockedAssetAmount(
        address user,
        address asset
    ) external view returns (uint256) {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        return
            ReserveLogic.assetAmountFromShares(
                reserve,
                lockedShares[user][asset],
                RAY
            );
    }

    function getUserClaimableAssetAmount(
        address user,
        address asset
    ) external view returns (uint256) {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        return
            ReserveLogic.assetAmountFromShares(
                reserve,
                custodiedShares[user][asset] - lockedShares[user][asset],
                RAY
            );
    }

    function getUserTotalDepositAssetAmount(
        address user,
        address asset
    ) external view returns (uint256) {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        uint256 totalShares = custodiedShares[user][asset] +
            reserve.aToken.balanceOf(user);
        return ReserveLogic.assetAmountFromShares(reserve, totalShares, RAY);
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

    function getUserDebtPrincipal(
        address user,
        address asset
    ) external view returns (uint256) {
        return userDebtPrincipal[user][asset];
    }

    function getUserDebtAmount(
        address user,
        address asset
    ) external view returns (uint256) {
        LendingPoolTypes.Reserve storage reserve = _getReserve(asset);
        return
            ReserveLogic.debtAmountFromPrincipal(
                reserve,
                userDebtPrincipal[user][asset],
                RAY
            );
    }

    // #endregion

    // #region Internal Helpers
    function _accrueInterest(
        address asset,
        LendingPoolTypes.Reserve storage reserve
    ) internal {
        uint256 factorRay = (reserveFactorBps[asset] * RAY) / BPS;
        (, uint256 protocolInterest) = ReserveLogic.executeAccrueInterest(
            asset,
            reserve,
            _availableLiquidity(asset),
            RAY,
            factorRay
        );
        if (protocolInterest > 0) {
            accruedProtocolFees[asset] += protocolInterest;
            emit ProtocolFeesAccrued(asset, protocolInterest);
        }
    }

    function _availableLiquidity(
        address asset
    ) internal view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function _updateDebtVaultHealthFactor(uint256 debtVaultId) internal {
        debtVaults[debtVaultId].healthFactor = healthFactor(debtVaultId);
    }

    function _handleRewardAction(
        address user,
        address asset,
        uint8 rewardType,
        uint256 totalPrincipal,
        uint256 userPrincipal
    ) internal {
        if (address(poolIncentivesController) == address(0)) {
            return;
        }

        poolIncentivesController.handleAction(
            user,
            asset,
            rewardType,
            totalPrincipal,
            userPrincipal
        );
    }

    function _getReserve(
        address asset
    ) internal view returns (LendingPoolTypes.Reserve storage reserve) {
        reserve = reserves[asset];
        require(reserve.enabled, "LendingPool: reserve missing");
    }
    // #endregion
}


