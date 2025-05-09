import express from 'express';
import multer from 'multer';
import {
  storeContent,
  retrieveContent,
  listPinnedItems,
  pinCID,
  unpinCID,
  queryIndex
} from '../controllers/IPFSindexControllers';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/ipfs/store
// Uploads a file to IPFS and indexes metadata in MongoDB
router.post('/store', upload.single('file'), storeContent);

// GET /api/ipfs/:cid
// Retrieves a file from IPFS by CID
router.get('/:cid', retrieveContent);

// GET /api/ipfs/pins
// Lists all pinned CIDs in IPFS
router.get('/pins', listPinnedItems);

// POST /api/ipfs/pin
// Pins a CID to IPFS
router.post('/pin', pinCID);

// POST /api/ipfs/unpin
// Unpins a CID from IPFS
router.post('/unpin', unpinCID);

// POST /api/ipfs/query
// Queries the MongoDB metadata index
router.post('/query', queryIndex);

export default router;