// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract PoolCoin is ERC20, Ownable {
    address public pool;

    modifier onlyPool() {
        require(msg.sender == pool, "PoolCoin: only pool");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address pool_
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        pool = pool_;
    }

    function setPool(address newPool) external onlyOwner {
        pool = newPool;
    }

    function mint(address to, uint256 amount) external onlyPool {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyPool {
        _burn(from, amount);
    }
}
