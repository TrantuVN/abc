import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    throw new Error(" PRIVATE_KEY is missing in .env file");
  }

  console.log(" Deploying Scoin...");

  const Scoin = await ethers.getContractFactory("Scoin");
  const scoin = await Scoin.deploy();

  await scoin.waitForDeployment();
  console.log(" Scoin deployed at:", await scoin.getAddress());
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
