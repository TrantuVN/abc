// routes/ipfsModerationRoutes.ts
import express from 'express';
import multer from 'multer';
import { storeModeratedFileHandler } from '../controllers/IPFSindexController';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/digest-ipfs', storeModeratedFileHandler);
router.get('/digest-ipfs', storeModeratedFileHandler);

export default router;
