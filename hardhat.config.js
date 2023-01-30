require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-truffle5"); //allows truffle tests to run in hardhat
require("@nomiclabs/hardhat-ethers"); //allows injected ethers
require("solidity-coverage"); //calculates code coverage to ensure better testing
require("hardhat-gas-reporter"); //calculates gas costs
require("hardhat-deploy"); //helps with deployments
require("hardhat-deploy-ethers"); //helps with deployments
const { accounts } = require("./test-wallets");

let { DEPLOYER_PK, OPERATIONS_PK, GYPSY_PK } = process.env;

//for testing deployments
DEPLOYER_PK = DEPLOYER_PK ? `0x${DEPLOYER_PK}` : accounts[0];
OPERATIONS_PK = OPERATIONS_PK ? `0x${OPERATIONS_PK}` : accounts[1];
GYPSY_PK = GYPSY_PK ? `0x${GYPSY_PK}` : accounts[2];

module.exports = {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [DEPLOYER_PK, OPERATIONS_PK, GYPSY_PK],
    },
  },
  namedAccounts: {
    deployer: 0,
    operation_wallet: 1,
    profit_wallet: 2,
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 800,
      },
      metadata: {
        // do not include the metadata hash, since this is machine dependent
        // and we want all generated code to be deterministic
        // https://docs.soliditylang.org/en/v0.7.6/metadata.html
        bytecodeHash: "none",
      },
    },
  },
  verify: {
    etherscan: {
      // Your API key for Etherscan
      // Obtain one at https://etherscan.io/
      apiKey: process.env.ETHERSCAN_API_KEY,
    },
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
