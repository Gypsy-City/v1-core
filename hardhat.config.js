require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-truffle5");
require("solidity-coverage");
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
