const hre = require("hardhat");
const { getCreateAddress, parseEther, parseUnits } = require("ethers");
const { priorityFeePerGas } = require('./helpers/gasEstimator');

const FACTORY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // AccountFactory address
const EP_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";     // EntryPoint address
const TOKEN_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
const PAY_ADDRESS = "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0";
const simpleAccountAddress = "0xD82079BC2cbd2baAe0E95F7Cf590D92A20D12978";
const eoaPublicKey = "0x1968365e67e3C0d5E8C1cf2e4dc61E4482099D86";
const eoaPrivateKey = "0x97db2b06a744329ea0a9308b203662c7c38f05c333160a321329c8104d61a6c3";



async function main() {

    const wallet = new ethers.Wallet(eoaPrivateKey);
    const signer = wallet.connect(hre.ethers.provider);

    const AccountFactory = await hre.ethers.getContractAt("AccountFactory", FACTORY_ADDRESS, signer);
    const entryPoint = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS, signer);
    const simpleAccount = await hre.ethers.getContractAt("SimpleAccount",simpleAccountAddress , signer);
    const exampleContract = await hre.ethers.getContractAt("Token", TOKEN_ADDRESS , signer);

    const balanceWei = await hre.ethers.provider.getBalance(signer.address);
    console.log(`The balance of the signer is: ${balanceWei} Wei`);

    let initCode = FACTORY_ADDRESS + AccountFactory.interface.encodeFunctionData('createAccount', [eoaPublicKey, 0]).slice(2);
    const funcTargetData = '0x';
    const data = simpleAccount.interface.encodeFunctionData('execute', [
        TOKEN_ADDRESS,
        0,
        funcTargetData
    ]);

    const code = await hre.ethers.provider.getCode(simpleAccountAddress);

    if (code !== '0x') {
        initCode = '0x'
    }

    console.log('maxPriorityFeePerGas:', await priorityFeePerGas());
    
    const userOp = {
        sender: simpleAccountAddress,
        nonce: await entryPoint.getNonce(simpleAccountAddress, 0),
        initCode: initCode,
        callData: data,
        callGasLimit: '100000',
        verificationGasLimit: '1000000',
        preVerificationGas: '0x10edc8',
        maxFeePerGas: '0x0973e0',
        maxPriorityFeePerGas: await priorityFeePerGas(),
        paymasterAndData: PAY_ADDRESS,
        signature: '0x'
    };

    const hash = await entryPoint.getUserOpHash(userOp);

    userOp.signature = await signer.signMessage(hre.ethers.getBytes(hash));

    try {
        const tx = await entryPoint.handleOps([userOp], eoaPublicKey, {
            gasLimit: 2000000
        });
        const receipt = await tx.wait();
        console.log('Transaction successful:', receipt);
    } catch (error) {
        console.error('Error sending transaction:', error);
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});