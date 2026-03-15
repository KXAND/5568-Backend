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
  PoolCoin public immutable poolCoin;      // deposit receipt (shares)
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

  event Deposit(address indexed user, uint256 amount, uint256 shares);
  event Withdraw(address indexed user, uint256 amount, uint256 shares);
  event Borrow(address indexed user, uint256 amount);
  event Repay(address indexed user, uint256 amount);
  event Accrue(uint256 interest, uint256 borrowIndex, uint256 liquidityIndex);
  event SetLtv(uint256 newLtv);
  event SetOracle(address newOracle);
  event SetInterestRateModel(address newModel);

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
