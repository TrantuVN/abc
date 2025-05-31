import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const ENTRY_POINT = process.env.ENTRY_POINT_ADDRESS;
  const Scoin_ADDRESS = process.env.SCOIN_ADDRESS;

  if (!ENTRY_POINT || !Scoin_ADDRESS) {
    throw new Error("Missing ENTRY_POINT_ADDRESS or SCOIN_ADDRESS in .env");
  }

  console.log("Deploying PaymasterToken...");

  const PaymasterToken = await ethers.getContractFactory("PaymasterToken");
  const paymaster = await PaymasterToken.deploy(ENTRY_POINT, Scoin_ADDRESS);

  await paymaster.waitForDeployment();
  console.log("PaymasterToken deployed at:", await paymaster.getAddress());
}

main().catch((error) => {
  console.error(" Deployment failed:", error);
  process.exitCode = 1;
});
