const hre = require("hardhat");
const FACTORY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // AccountFactory address
const EP_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";     // EntryPoint address
async function main() {
  
    const pm = await hre.ethers.deployContract("Paymaster", [FACTORY_ADDRESS, EP_ADDRESS]); // convey address to EntryPoint
    await pm.waitForDeployment();
    console.log(`PM deployed to ${pm.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
