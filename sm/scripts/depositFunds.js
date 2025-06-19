const hre = require("hardhat");
require('dotenv').config();

const EP_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
const PAY_ADDRESS = "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0";
const eoaPublicKey = "0x67bd9044E7C7608E84F07B77FdC6E0139A65DE07";


async function main() {

    // Create a wallet instance with the private key
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);

    // Connect the wallet to the Hardhat network provider
    const signer = wallet.connect(hre.ethers.provider);

    const entryPoint = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, signer);

    const sendFunds = await entryPoint.depositTo(PAY_ADDRESS, {
        value: hre.ethers.parseUnits("5000000", "gwei"),
    });
    const receipt1 = await sendFunds.wait();
    console.log(receipt1);

    const tx = {
        to: eoaPublicKey,
        value: hre.ethers.parseUnits("5000000", "gwei")
    };

    const transactionResponse = await signer.sendTransaction(tx);
    const receipt2 = await transactionResponse.wait();
    console.log(receipt2);
    
    
console.log('deposit successful');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});