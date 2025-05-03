// backend/src/routes/dnaencodeRoutes.ts

import express from 'express';
import multer from 'multer';
import { encodeDNAHandler } from '../controllers/dnaencodeController';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Route: POST /encode-dna
router.post('/encode-dna', upload.single('file'), encodeDNAHandler);

export default router;
