const USDGToken = artifacts.require("../contracts/USDGToken.sol");
const GPSYToken = artifacts.require("../contracts/TestGPSY.sol");
const HomeNFT = artifacts.require("../contracts/HomeNFT.sol");
const REIT = artifacts.require("../contracts/REIT.sol");
const LGPSYToken = artifacts.require("../contracts/LGPSYToken.sol");

module.exports = async function (deployer, network, accounts) {
  console.log("deploying to :", network);

  let OWNER, REIT_OPERATIONS, REIT_PROFIT;

  if (network == "develop") {
    OWNER = accounts[0];
    REIT_OPERATIONS = accounts[3];
    REIT_PROFIT = accounts[4];
  } else {
    OWNER = "0x460841dfe40088af0bcb3ca0fa758c810e11474e";
    REIT_OPERATIONS = "0x4e328d9a0ccc1fa27b6fa4bacbdb46d6bc6e4928";
    REIT_PROFIT = "0xb06e68188fd6B3a7bd272cE94316Fa77A2859467";
  }

  console.log("======Starting deployment======");
  let USDGTokenContract = await deployer.deploy(USDGToken, {
    from: OWNER,
  });

  console.log("Deployed USDG:", USDGToken.address);

  let GPSYTokenContract = await deployer.deploy(GPSYToken, {
    from: OWNER,
  });

  console.log("Deployed GPSY:", GPSYToken.address);

  let HomeNFTContract = await deployer.deploy(
    HomeNFT,
    GPSYToken.address,
    USDGToken.address,
    { from: OWNER }
  );
  console.log("Deployed HomeNFT:", HomeNFT.address);

  let LGPSYTokenContract = await deployer.deploy(
    LGPSYToken,
    "Staked Gypsy",
    "sGPSY",
    OWNER,
    GPSYToken.address,
    18,
    {
      from: OWNER,
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
      from: OWNER,
    }
  );

  console.log("Deployed REIT:", REIT.address);

  console.log("======Finished deployment======");
  console.log("======Connecting Deployed Contracts======");

  //connect HomeNFT to REIT

  await HomeNFTContract.setReit(REIT.address);
  console.log("Connected REIT to HomeNFT");

  console.log("======Done Connecting Deployed Contracts======");
};
