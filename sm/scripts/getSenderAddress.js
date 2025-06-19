const hre = require("hardhat");
const { createEOA } = require('./helpers/createEOAwallet');
const { isAddress } = require("ethers");

const FACTORY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const EP_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

async function main() {
  const AccountFactory = await hre.ethers.getContractAt("AccountFactory", FACTORY_ADDRESS);
  const EOA = createEOA();
  const entryPoint = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS);

  const initCode = FACTORY_ADDRESS + AccountFactory.interface.encodeFunctionData('createAccount', [EOA[0], 0]).slice(2);

  let simpleAccountAddress;

try {
  await entryPoint.getSenderAddress(initCode);
} catch (err) {
  const rawRevertData = err?.error?.data || err?.data;

  if (typeof rawRevertData === 'string' && rawRevertData.length >= 138) {
    // Last 40 hex chars = 20 bytes = address
    simpleAccountAddress = '0x' + rawRevertData.slice(-40);
  } else {
    // Fallback attempt using regex
    const message = err?.error?.message || err?.message || "";
    const match = message.match(/SenderAddressResult\("?(0x[a-fA-F0-9]{40})"?\)/);
    if (match && match[1]) {
      simpleAccountAddress = match[1];
    } else {
      throw new Error(" Could not extract simpleAccountAddress from error.");
    }
  }
}
console.log('simpleAccountAddress:', simpleAccountAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
