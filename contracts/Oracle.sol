// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleOracle is Ownable {
  mapping(address => uint256) private _price;

  // For simulation/testing purposes - anyone can update price
  bool public publicUpdateEnabled = true; // Enabled by default for testing

  event PriceUpdated(address indexed asset, uint256 price, uint256 timestamp);
  event PublicUpdateToggled(bool enabled);

  constructor() Ownable(msg.sender) {}

  // Enable/disable public price updates (for testing)
  function togglePublicUpdate(bool enabled) external onlyOwner {
    publicUpdateEnabled = enabled;
    emit PublicUpdateToggled(enabled);
  }

  // Owner can set price anytime
  function setPrice(address asset, uint256 price) external onlyOwner {
    _setPrice(asset, price);
  }

  // Public users can set price (if enabled, for testing/scripts)
  function setPricePublic(address asset, uint256 price) external {
    require(publicUpdateEnabled, "Oracle: Public update disabled");
    require(price > 0, "Oracle: Price must be positive");
    _setPrice(asset, price);
  }

  // Batch update multiple token prices (useful for scripts)
  function setPrices(address[] calldata assets, uint256[] calldata prices) external {
    require(publicUpdateEnabled, "Oracle: Public update disabled");
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
    // For simulation, return default price if not set
    if (price == 0) {
      // Simulated default prices (based on project design):
      // - ALC (Alice Token): simulates ETH, price 2000 USD (2000e18)
      // - BOB (Bob Token): simulates USDC, price 1 USD (1e18)
      // Note: Cannot know if asset is ALC or BOB here, so return generic default
      // In practice, prices should be set first
      return 1e18; // Default to 1 USD
    }
    return price;
  }

  // Helper function: for scripts to check if price is set
  function getPriceWithInfo(address asset) external view returns (uint256 price, bool isSet) {
    price = _price[asset];
    isSet = price > 0;
    if (!isSet) {
      price = 1e18; // Default price
    }
  }

  // Get simulated default price suggestions (for external reference only)
  function getDefaultPriceSuggestion() external pure returns (
    uint256 alcPrice,
    uint256 bobPrice,
    string memory description
  ) {
    // ALC simulates ETH: 2000 USD
    alcPrice = 2000e18;
    // BOB simulates USDC: 1 USD
    bobPrice = 1e18;
    description = "ALC simulates ETH (2000 USD), BOB simulates USDC (1 USD)";
  }
}

