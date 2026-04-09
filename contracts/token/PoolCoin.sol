// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PoolCoin is ERC20 {
    constructor(
        address initialHolder,
        uint256 initialSupply
    ) ERC20("PoolCoin", "POOL") {
        require(initialHolder != address(0), "PoolCoin: bad holder");
        _mint(initialHolder, initialSupply);
    }
}
