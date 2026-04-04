// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ALICE DOLLAR: The stablecoin
contract AliceToken is ERC20, Ownable {
    constructor(
        address initialOwner
    ) ERC20("Alice Dollar", "ALC") Ownable(initialOwner) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

/// @title A faucet of ALC
/// @notice Allowing user get some free ALCs
contract AliceFaucet is Ownable {
    AliceToken public immutable token;
    uint256 public immutable dripAmount;
    uint256 public immutable cooldown;

    mapping(address => uint256) public lastClaimAt;

    constructor(
        uint256 initialSupply,
        uint256 _dripAmount,
        uint256 _cooldown
    ) Ownable(msg.sender) {
        token = new AliceToken(address(this));
        token.mint(address(this), initialSupply);
        dripAmount = _dripAmount;
        cooldown = _cooldown;
    }

    function claim() external {
        uint256 last = lastClaimAt[msg.sender];
        require(block.timestamp - last >= cooldown, "Faucet: cooldown");
        lastClaimAt[msg.sender] = block.timestamp;
        require(
            token.transfer(msg.sender, dripAmount),
            "Faucet: transfer failed"
        );
    }

    function refill(uint256 amount) external onlyOwner {
        token.mint(address(this), amount);
    }
}
