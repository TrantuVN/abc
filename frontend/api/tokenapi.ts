// ./api/token.ts
import axios from 'axios';

const BASE = '/api/token';

export const stakeTokens = (validator: string, amount: string) =>
  axios.post(`${BASE}/stake`, { validator, amount });

export const unstakeTokens = (validator: string) =>
  axios.post(`${BASE}/unstake`, { validator });

export const getValidatorInfo = (address: string) =>
  axios.get(`${BASE}/validator/${address}`);

export const getAllValidators = () =>
  axios.get(`${BASE}/validators`);

export const distributeRewards = () =>
  axios.post(`${BASE}/rewards/distribute`);