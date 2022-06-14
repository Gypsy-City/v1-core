const Mortgage = artifacts.require("../contracts/Mortgage.sol");
const Marketplace = artifacts.require("../contracts/Marketplace.sol");


module.exports = function (deployer) {
  deployer.deploy(Marketplace);
  deployer.deploy(Mortgage,"0x958A3faab1EC7aFFeeDA492E5aE93581891cC591",5,250000)
};