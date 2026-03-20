// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleOracle is Ownable {
  mapping(address => uint256) private _price;

  event PriceUpdated(address indexed asset, uint256 price, uint256 timestamp);

  constructor() Ownable(msg.sender) {}

  // Owner can set price anytime
  function setPrice(address asset, uint256 price) external onlyOwner {
    _setPrice(asset, price);
  }

  // Batch update multiple token prices
  function setPrices(address[] calldata assets, uint256[] calldata prices) external onlyOwner {
    require(assets.length == prices.length, "Oracle: Array length mismatch");
    for (uint256 i = 0; i < assets.length; i++) {
      require(prices[i] > 0, "Oracle: Price must be positive");
      _setPrice(assets[i], prices[i]);
    }
  }

  // Internal function: set price
  function _setPrice(address asset, uint256 price) internal {
    _price[asset] = price;
    emit PriceUpdated(asset, price, block.timestamp);
  }

  function getPrice(address asset) external view returns (uint256) {
    uint256 price = _price[asset];
    return price;
  }
}

