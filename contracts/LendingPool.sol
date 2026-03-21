// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {PoolCoin} from "./PoolCoin.sol";
import {InterestRateModel} from "./InterestRate.sol";
import {SimpleOracle} from "./Oracle.sol";

contract LendingPool is Ownable {
  using SafeERC20 for IERC20;

  IERC20 public immutable collateralToken; // e.g. BobToken
  IERC20 public immutable borrowToken;     // e.g. AliceToken
  PoolCoin public immutable poolCoin;       // deposit receipt (shares)
  SimpleOracle public oracle;
  InterestRateModel public interestRateModel;

  // LTV scaled by 1e18 (e.g. 0.75e18 = 75%)
  uint256 public ltv;

  uint256 public totalBorrows;
  uint256 public borrowIndex = 1e18;
  uint256 public liquidityIndex = 1e18;
  uint256 public lastAccrualBlock;

  mapping(address => uint256) public userBorrowPrincipal;
  mapping(address => uint256) public userBorrowIndex;

  // 借款用户列表
  mapping(address => bool) public isBorrower;
  address[] public borrowers;

  // 清算相关
  uint256 public constant BONUS_BASE = 10000;
  uint256 public liquidationBonus = 500;
  uint256 public liquidationThreshold = 1e18;
  uint256 public totalLiquidations;

  event Deposit(address indexed user, uint256 amount, uint256 shares);
  event Withdraw(address indexed user, uint256 amount, uint256 shares);
  event Borrow(address indexed user, uint256 amount);
  event Repay(address indexed user, uint256 amount);
  event Accrue(uint256 interest, uint256 borrowIndex, uint256 liquidityIndex);
  event SetLtv(uint256 newLtv);
  event SetOracle(address newOracle);
  event SetInterestRateModel(address newModel);
  // 清算事件
  event SetLiquidationBonus(uint256 bonus);
  event SetLiquidationThreshold(uint256 threshold);
  event LiquidationExecuted(
    address indexed liquidator,
    address indexed borrower,
    uint256 debtRepaid,
    uint256 collateralLiquidated,
    uint256 bonus
  );

  constructor(
    address _collateralToken,
    address _borrowToken,
    address _oracle,
    address _interestRateModel,
    uint256 _ltv,
    string memory poolCoinName,
    string memory poolCoinSymbol
  ) Ownable(msg.sender) {
    require(_ltv <= 1e18, "LendingPool: bad ltv");
    collateralToken = IERC20(_collateralToken);
    borrowToken = IERC20(_borrowToken);
    oracle = SimpleOracle(_oracle);
    interestRateModel = InterestRateModel(_interestRateModel);
    ltv = _ltv;
    poolCoin = new PoolCoin(poolCoinName, poolCoinSymbol, msg.sender, address(this));
    lastAccrualBlock = block.number;
  }

  function setLtv(uint256 newLtv) external onlyOwner {
    require(newLtv <= 1e18, "LendingPool: bad ltv");
    ltv = newLtv;
    emit SetLtv(newLtv);
  }

  function setOracle(address newOracle) external onlyOwner {
    oracle = SimpleOracle(newOracle);
    emit SetOracle(newOracle);
  }

  function setInterestRateModel(address newModel) external onlyOwner {
    interestRateModel = InterestRateModel(newModel);
    emit SetInterestRateModel(newModel);
  }

  // 清算配置函数
  function setLiquidationBonus(uint256 _bonus) external onlyOwner {
    require(_bonus <= 3000, "Bonus too high");
    liquidationBonus = _bonus;
    emit SetLiquidationBonus(_bonus);
  }

  function setLiquidationThreshold(uint256 _threshold) external onlyOwner {
    require(_threshold > 0, "Threshold must be > 0");
    liquidationThreshold = _threshold;
    emit SetLiquidationThreshold(_threshold);
  }

  // 清算函数
  function liquidate(address borrower, uint256 repayAmount) external {
    require(borrower != address(0), "Invalid borrower");
    
    // 检查健康因子
    uint256 userHealthFactor = this.healthFactor(borrower);
    require(userHealthFactor < liquidationThreshold, "Position healthy");
    
    // 检查债务
    uint256 debt = _borrowBalance(borrower);
    require(debt > 0, "No debt");
    
    // 确定实际还款金额
    uint256 actualRepay = repayAmount == 0 || repayAmount > debt ? debt : repayAmount;
    
    // 从清算者处接收还款代币
    borrowToken.safeTransferFrom(msg.sender, address(this), actualRepay);
    
    // 直接还款
    _repayInternal(borrower, actualRepay);
    
    // 计算清算奖励
    uint256 bonus = (actualRepay * liquidationBonus) / BONUS_BASE;
    
    // 获取借款人抵押品
    uint256 borrowerShares = poolCoin.balanceOf(borrower);
    require(borrowerShares > 0, "No collateral");
    
    // 计算清算抵押品数量 (简化版: 按价值比例)
    uint256 collateralPrice = oracle.getPrice(address(collateralToken));
    uint256 borrowPrice = oracle.getPrice(address(borrowToken));
    uint256 totalValue = ((actualRepay + bonus) * borrowPrice) / 1e18;
    uint256 collateralToLiquidate = (totalValue * 1e18) / collateralPrice;
    
    // 不能超过借款人抵押品
    uint256 maxCollateral = _underlyingFromShares(borrowerShares);
    if (collateralToLiquidate > maxCollateral) {
      collateralToLiquidate = maxCollateral;
    }
    
    // 销毁对应份额
    uint256 sharesToBurn = (collateralToLiquidate * 1e18) / liquidityIndex;
    if (sharesToBurn > borrowerShares) {
      sharesToBurn = borrowerShares;
    }
    
    poolCoin.burn(borrower, sharesToBurn);
    collateralToken.safeTransfer(msg.sender, collateralToLiquidate);
    
    totalLiquidations++;
    
    emit LiquidationExecuted(msg.sender, borrower, actualRepay, collateralToLiquidate, bonus);
  }

  // 内部还款逻辑
  function _repayInternal(address borrower, uint256 amount) internal {
    uint256 currentBorrow = _borrowBalance(borrower);
    require(currentBorrow >= amount, "Repay exceeds debt");
    
    uint256 newBorrow = currentBorrow - amount;
    totalBorrows -= amount;
    userBorrowPrincipal[borrower] = newBorrow;
    userBorrowIndex[borrower] = borrowIndex;
    
    emit Repay(borrower, amount);
  }

  // 估算清算收益
  function estimateLiquidationProfit(uint256 repayAmount) external view returns (uint256 bonus, uint256 collateralOut) {
    bonus = (repayAmount * liquidationBonus) / BONUS_BASE;
    
    uint256 borrowPrice = oracle.getPrice(address(borrowToken));
    uint256 collateralPrice = oracle.getPrice(address(collateralToken));
    
    uint256 totalValue = ((repayAmount + bonus) * borrowPrice) / 1e18;
    collateralOut = (totalValue * 1e18) / collateralPrice;
  }

  // 获取借款用户列表
  function getBorrowers() external view returns (address[] memory) {
    return borrowers;
  }
  
  // 获取可清算账户列表
  function getLiquidatableAccounts() external view returns (address[] memory) {
    address[] memory result = new address[](borrowers.length);
    uint256 count = 0;
    
    for (uint256 i = 0; i < borrowers.length; i++) {
      address user = borrowers[i];
      uint256 hf = this.healthFactor(user);
      if (hf < liquidationThreshold && hf > 0) {
        result[count] = user;
        count++;
      }
    }
    
    // 调整数组大小
    address[] memory liquidatable = new address[](count);
    for (uint256 i = 0; i < count; i++) {
      liquidatable[i] = result[i];
    }
    return liquidatable;
  }
  
  // 获取用户详情
  function getAccountInfo(address user) external view returns (
    uint256 collateral,
    uint256 debt,
    uint256 healthFactor_
  ) {
    collateral = _underlyingFromShares(poolCoin.balanceOf(user));
    debt = _borrowBalance(user);
    healthFactor_ = this.healthFactor(user);
  }

  function deposit(uint256 amount) external {
    require(amount > 0, "LendingPool: amount=0");
    _accrueInterest();

    collateralToken.safeTransferFrom(msg.sender, address(this), amount);
    uint256 shares = _sharesFromUnderlying(amount);
    poolCoin.mint(msg.sender, shares);
    emit Deposit(msg.sender, amount, shares);
  }

  function withdraw(uint256 amount) external {
    require(amount > 0, "LendingPool: amount=0");
    _accrueInterest();

    uint256 shares = _sharesFromUnderlying(amount);
    uint256 userShares = poolCoin.balanceOf(msg.sender);
    require(userShares >= shares, "LendingPool: insufficient deposit");

    // check health after withdrawal
    uint256 newShares = userShares - shares;
    uint256 newCollateral = _underlyingFromShares(newShares);
    _requireHealthy(newCollateral, _borrowBalance(msg.sender));

    poolCoin.burn(msg.sender, shares);
    collateralToken.safeTransfer(msg.sender, amount);
    emit Withdraw(msg.sender, amount, shares);
  }

  function borrow(uint256 amount) external {
    require(amount > 0, "LendingPool: amount=0");
    _accrueInterest();

    uint256 cash = borrowToken.balanceOf(address(this));
    require(cash >= amount, "LendingPool: insufficient liquidity");

    uint256 currentBorrow = _borrowBalance(msg.sender);
    uint256 newBorrow = currentBorrow + amount;
    uint256 collateral = _underlyingFromShares(poolCoin.balanceOf(msg.sender));
    _requireHealthy(collateral, newBorrow);

    totalBorrows += amount;
    userBorrowPrincipal[msg.sender] = newBorrow;
    userBorrowIndex[msg.sender] = borrowIndex;
    
    // 记录借款用户
    if (!isBorrower[msg.sender]) {
      isBorrower[msg.sender] = true;
      borrowers.push(msg.sender);
    }

    borrowToken.safeTransfer(msg.sender, amount);
    emit Borrow(msg.sender, amount);
  }

  function repay(uint256 amount) external {
    require(amount > 0, "LendingPool: amount=0");
    _accrueInterest();

    uint256 currentBorrow = _borrowBalance(msg.sender);
    require(currentBorrow > 0, "LendingPool: no debt");

    uint256 repayAmount = amount > currentBorrow ? currentBorrow : amount;
    borrowToken.safeTransferFrom(msg.sender, address(this), repayAmount);

    uint256 newBorrow = currentBorrow - repayAmount;
    totalBorrows -= repayAmount;
    userBorrowPrincipal[msg.sender] = newBorrow;
    userBorrowIndex[msg.sender] = borrowIndex;

    emit Repay(msg.sender, repayAmount);
  }

  // owner can add borrow token liquidity
  function fundBorrowToken(uint256 amount) external onlyOwner {
    borrowToken.safeTransferFrom(msg.sender, address(this), amount);
  }

  function getUtilization() public view returns (uint256) {
    uint256 cash = borrowToken.balanceOf(address(this));
    if (totalBorrows == 0 && cash == 0) return 0;
    return (totalBorrows * 1e18) / (cash + totalBorrows);
  }

  function healthFactor(address user) external view returns (uint256) {
    uint256 collateral = _underlyingFromShares(poolCoin.balanceOf(user));
    return _healthFactor(collateral, _borrowBalanceView(user));
  }

  function _accrueInterest() internal {
    uint256 blocksElapsed = block.number - lastAccrualBlock;
    if (blocksElapsed == 0) return;

    uint256 util = getUtilization();
    uint256 borrowRate = interestRateModel.getBorrowRate(util);
    uint256 supplyRate = (borrowRate * util) / 1e18;

    uint256 interest = (totalBorrows * borrowRate * blocksElapsed) / 1e18;

    totalBorrows += interest;
    borrowIndex = borrowIndex + (borrowIndex * borrowRate * blocksElapsed) / 1e18;
    liquidityIndex = liquidityIndex + (liquidityIndex * supplyRate * blocksElapsed) / 1e18;
    lastAccrualBlock = block.number;

    emit Accrue(interest, borrowIndex, liquidityIndex);
  }

  function _borrowBalance(address user) internal view returns (uint256) {
    uint256 principal = userBorrowPrincipal[user];
    uint256 index = userBorrowIndex[user];
    if (principal == 0) return 0;
    if (index == 0) return principal;
    return (principal * borrowIndex) / index;
  }

  function _borrowBalanceView(address user) internal view returns (uint256) {
    uint256 principal = userBorrowPrincipal[user];
    uint256 index = userBorrowIndex[user];
    if (principal == 0) return 0;
    if (index == 0) return principal;
    return (principal * borrowIndex) / index;
  }

  function _sharesFromUnderlying(uint256 amount) internal view returns (uint256) {
    return (amount * 1e18) / liquidityIndex;// idx is a decimal
  }

  function _underlyingFromShares(uint256 shares) internal view returns (uint256) {
    return (shares * liquidityIndex) / 1e18;
  }

  function _healthFactor(uint256 collateralAmount, uint256 borrowAmount) internal view returns (uint256) {
    if (borrowAmount == 0) return type(uint256).max;

    uint256 collateralPrice = oracle.getPrice(address(collateralToken));
    uint256 borrowPrice = oracle.getPrice(address(borrowToken));

    uint256 collateralValue = (collateralAmount * collateralPrice) / 1e18;
    uint256 debtValue = (borrowAmount * borrowPrice) / 1e18;

    return (collateralValue * ltv) / debtValue;
  }

  function _requireHealthy(uint256 collateralAmount, uint256 borrowAmount) internal view {
    uint256 hf = _healthFactor(collateralAmount, borrowAmount);
    require(hf >= 1e18, "LendingPool: unhealthy");
  }
}
