require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-truffle5"); //allows truffle tests to run in hardhat
require("solidity-coverage"); //calculates code coverage to ensure better testing
require("hardhat-gas-reporter"); //calculates gas costs

module.exports = {
  solidity: "0.8.17",
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    token: "MATIC", //Can be "ETH" or "MATIC"
    gasPriceApi:
      "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice", //Can be "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice" or "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice"
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
};
