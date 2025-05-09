import express from 'express';
import multer from 'multer';
import { encodeDNAHandler } from '../controllers/dnaencodeController';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/dna/encode-dna
// Encodes a file into DNA sequences using the Wukong codec algorithm
router.post('/encode-dna', upload.single('file'), encodeDNAHandler);

export default router;