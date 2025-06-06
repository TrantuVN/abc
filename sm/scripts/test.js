const hre = require("hardhat");
const EP_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
async function main() {
    const code = await hre.ethers.provider.getCode(EP_ADDRESS);
    console.log(code);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});