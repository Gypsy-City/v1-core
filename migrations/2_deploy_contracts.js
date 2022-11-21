const USDGToken = artifacts.require("../contracts/USDGToken.sol");
const GPSYToken = artifacts.require("../contracts/TestGPSY.sol");
const HomeNFT = artifacts.require("../contracts/HomeNFT.sol");
const REIT = artifacts.require("../contracts/REIT.sol");
const LGPSYToken = artifacts.require("../contracts/LGPSYToken.sol");

module.exports = async function (deployer, network, accounts) {
  //ACCOUNTS
  const owner = accounts[0];
  const REIT_OPERATIONS = accounts[3];
  const REIT_PROFIT = accounts[4];
  console.log("======Starting deployment======");
  let USDGTokenContract = await deployer.deploy(USDGToken, {
    from: owner,
  });

  console.log("Deployed USDG:", USDGToken.address);

  let GPSYTokenContract = await deployer.deploy(GPSYToken, {
    from: owner,
  });

  console.log("Deployed GPSY:", GPSYToken.address);

  let HomeNFTContract = await deployer.deploy(
    HomeNFT,
    GPSYToken.address,
    USDGToken.address,
    { from: owner }
  );
  console.log("Deployed HomeNFT:", HomeNFT.address);
  //string memory name_, string memory symbol_, address owner_, address asset_, uint256 precision_

  let LGPSYTokenContract = await deployer.deploy(
    LGPSYToken,
    "Staked Gypsy",
    "sGPSY",
    owner,
    GPSYToken.address,
    18,
    {
      from: owner,
    }
  );

  console.log("Deployed LGPSYToken:", LGPSYToken.address);

  let REITContract = await deployer.deploy(
    REIT,
    USDGToken.address,
    GPSYToken.address,
    LGPSYToken.address,
    HomeNFT.address,
    REIT_OPERATIONS,
    REIT_PROFIT,
    {
      from: owner,
    }
  );

  console.log("Deployed REIT:", REIT.address);

  console.log("======Finished deployment======");
};
