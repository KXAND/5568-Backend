// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract IssuedToken is ERC20, Ownable {
    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address initialRecipient,
        uint256 initialSupply
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        if (initialSupply > 0) {
            _mint(initialRecipient, initialSupply);
        }
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

/// @title TokenIssuer
/// @notice Helper to quickly deploy ERC20 tokens and optionally faucet.
contract TokenIssuer is Ownable {
    struct FaucetConfig {
        uint256 dripAmount;
        uint256 cooldown;
        bool enabled;
    }

    struct IssuedTokenInfo {
        string name;
        string symbol;
        address token;
        address owner;
        address initialRecipient;
        uint256 initialSupply;
        bool faucetEnabled;
        uint256 dripAmount;
        uint256 cooldown;
    }

    mapping(address => FaucetConfig) public faucetConfigs;
    mapping(address => mapping(address => uint256)) public lastClaimAt;
    mapping(bytes32 => address) private tokenByName;
    IssuedTokenInfo[] private issuedTokens;

    event TokenIssued(
        address indexed token,
        string name,
        string symbol,
        address indexed owner,
        address indexed initialRecipient,
        uint256 initialSupply
    );
    event FaucetIssued(
        address indexed token,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 dripAmount,
        uint256 cooldown
    );

    constructor() Ownable(msg.sender) {}

    function issueToken(
        string calldata name_,
        string calldata symbol_,
        address owner_,
        address initialRecipient,
        uint256 initialSupply
    ) external returns (address token) {
        require(owner_ != address(0), "TokenIssuer: bad owner");
        require(initialRecipient != address(0), "TokenIssuer: bad recipient");
        require(_tokenByName(name_) == address(0), "TokenIssuer: name exists");

        token = address(
            new IssuedToken(
                name_,
                symbol_,
                owner_,
                initialRecipient,
                initialSupply
            )
        );

        tokenByName[_nameKey(name_)] = token;
        issuedTokens.push(
            IssuedTokenInfo({
                name: name_,
                symbol: symbol_,
                token: token,
                owner: owner_,
                initialRecipient: initialRecipient,
                initialSupply: initialSupply,
                faucetEnabled: false,
                dripAmount: 0,
                cooldown: 0
            })
        );

        emit TokenIssued(
            token,
            name_,
            symbol_,
            owner_,
            initialRecipient,
            initialSupply
        );
    }

    function issueTokenWithFaucet(
        string calldata name_,
        string calldata symbol_,
        uint256 initialSupply,
        uint256 dripAmount,
        uint256 cooldown
    ) external returns (address token) {
        require(_tokenByName(name_) == address(0), "TokenIssuer: name exists");

        token = address(
            new IssuedToken(
                name_,
                symbol_,
                address(this),
                address(this),
                initialSupply
            )
        );

        faucetConfigs[token] = FaucetConfig({
            dripAmount: dripAmount,
            cooldown: cooldown,
            enabled: true
        });
        tokenByName[_nameKey(name_)] = token;
        issuedTokens.push(
            IssuedTokenInfo({
                name: name_,
                symbol: symbol_,
                token: token,
                owner: address(this),
                initialRecipient: address(this),
                initialSupply: initialSupply,
                faucetEnabled: true,
                dripAmount: dripAmount,
                cooldown: cooldown
            })
        );

        emit FaucetIssued(
            token,
            name_,
            symbol_,
            initialSupply,
            dripAmount,
            cooldown
        );
    }

    function claim(address token) external {
        FaucetConfig memory config = faucetConfigs[token];
        require(config.enabled, "Faucet: disabled");

        uint256 last = lastClaimAt[token][msg.sender];
        require(block.timestamp - last >= config.cooldown, "Faucet: cooldown");
        lastClaimAt[token][msg.sender] = block.timestamp;

        require(
            IssuedToken(token).transfer(msg.sender, config.dripAmount),
            "Faucet: transfer failed"
        );
    }

    function refill(address token, uint256 amount) external onlyOwner {
        require(faucetConfigs[token].enabled, "Faucet: disabled");
        IssuedToken(token).mint(address(this), amount);
    }

    function getIssuedTokenCount() external view returns (uint256) {
        return issuedTokens.length;
    }

    function getIssuedTokenInfo(
        uint256 index
    ) external view returns (IssuedTokenInfo memory) {
        return issuedTokens[index];
    }

    function getTokenByName(
        string calldata name_
    ) external view returns (address) {
        return _tokenByName(name_);
    }

    function _tokenByName(string memory name_) internal view returns (address) {
        return tokenByName[_nameKey(name_)];
    }

    function _nameKey(string memory name_) internal pure returns (bytes32) {
        return keccak256(bytes(name_));
    }
}
