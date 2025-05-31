import hre from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const ENTRY_POINT = process.env.ENTRY_POINT!;
  const OWNER = process.env.OWNER || deployer.address;

  const SmartWallet = await ethers.getContractFactory("SmartWallet");
  const wallet = await SmartWallet.deploy(ENTRY_POINT, OWNER);
  await wallet.deployed();
  console.log(`SmartWallet: ${wallet.address}`);

  await deployer.sendTransaction({
    to: await wallet.getAddress(),
    value: ethers.parseEther("1.01"),
  });
  console.log("💸 Funded 1.01 ETH");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
