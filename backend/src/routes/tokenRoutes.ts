import express from 'express';
import {
  stakeTokens,
  getValidatorInfo,
  getAllValidators,
  distributeRewards
} from '../controllers/tokenController';

const router = express.Router();

router.get('/staketoken', stakeTokens);
router.post('/staketoken', stakeTokens);
router.get('/getvali', getValidatorInfo);
router.post('/getvali', getValidatorInfo);
router.get('/getall', getAllValidators);
router.post('/getall', getAllValidators);
router.post('/getrewards', distributeRewards);
export default router; //

