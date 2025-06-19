const hre = require("hardhat");
const EP_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; 

async function main() {

  const AccountFactory = await hre.ethers.deployContract("AccountFactory",[EP_ADDRESS]);
  
  await AccountFactory.waitForDeployment();

  console.log(
    `AccountFactory deployed to ${AccountFactory.target}` 
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
})