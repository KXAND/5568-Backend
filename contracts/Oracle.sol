// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleOracle is Ownable {
  mapping(address => uint256) private _price;

  constructor() Ownable(msg.sender) {}

  // price is scaled by 1e18
  function setPrice(address asset, uint256 price) external onlyOwner {
    _price[asset] = price;
  }

  function getPrice(address asset) external view returns (uint256) {
    return _price[asset];
  }
}
