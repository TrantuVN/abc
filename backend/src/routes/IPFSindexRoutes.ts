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

router.post('/store', upload.single('file'), storeContent);
router.get('/:cid', retrieveContent);

router.get('/pins', listPinnedItems);
router.post('/pin', pinCID);
router.post('/unpin', unpinCID);
router.post('/query', queryIndex);

export default router;
