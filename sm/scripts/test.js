const hre = require("hardhat");

const exampleContractAddress = 
const simpleAccountAddress =

async function main() {

    const exampleContract = await hre.ethers.getContractAt("Token", exampleContractAddress);

    const tokenId = await exampleContract.tokenId();
    console.log("tokenId:", tokenId);

    const balance = await exampleContract.balanceOf(simpleAccountAddress)
    console.log("balance:", balance);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});