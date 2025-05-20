// src/services/token.ts

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import ScoinABI from '../abi/Scoin.json';

dotenv.config();

const {
  ETH_RPC_URL,
  PRIVATE_KEY,
  SCOIN_ADDRESS
} = process.env;

if (!PRIVATE_KEY || !SCOIN_ADDRESS || !ETH_RPC_URL) {
  throw new Error('Environment variables PRIVATE_KEY, SCOIN_ADDRESS, and ETH_RPC_URL must be set.');
}

const provider = new ethers.providers.JsonRpcProvider(ETH_RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY!, provider);
const scoin = new ethers.Contract(SCOIN_ADDRESS!, ScoinABI, signer);

export const stakeTokens = async (amount: string) => {
  const parsedAmount = ethers.utils.parseUnits(amount, 18);
  const tx = await scoin.stake(parsedAmount);
  return tx.wait();
};

export const unstakeTokens = async () => {
  const tx = await scoin.unstake();
  return tx.wait();
};

export const getValidatorInfo = async (address: string) => {
  return scoin.getValidatorInfo(address);
};

export const getAllValidators = async () => {
  return scoin.getValidators();
};

export const distributeRewards = async (validator: string, amount: string) => {
  const parsedAmount = ethers.utils.parseUnits(amount, 18);
  const tx = await scoin.distributeRewards(validator, parsedAmount);
  return tx.wait();
};
