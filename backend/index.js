const express = require('express');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { unlink } = require('fs/promises');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

const storeModeratedFile = require('./services/IPFSindex.js');

const app = express();
const port = process.env.PORT || 3000;

const diskUpload = multer({ dest: 'Uploads/' });
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

const HIVE_API_KEY = process.env.HIVE_API_KEY || 'tpLvzIMIVc5YpBs1EJYQLA==';

// Utility to handle async file cleanup
const cleanupFile = async (filePath) => {
  if (filePath) {
    await unlink(filePath).catch((err) => console.error('File deletion error:', err));
  }
};

// Utility to handle errors
const handleError = (res, error, status = 500) => {
  console.error('Error:', error.message);
  console.log('Error details:', error.response?.data || error);
  if (error.response) {
    return res.status(error.response.status).json({
      error: 'Service error',
      details: error.response.data,
      message: error.response.data?.message || 'Request failed',
    });
  }
  return res.status(status).json({ error: 'Internal server error', message: error.message });
};

// Utility to run Python scripts
const runPythonScript = (args) => new Promise((resolve, reject) => {
  const storageDParentPath = 'C:\\Users\\Multiplexon\\Desktop\\thesis\\Scoin - Copy\\Storage-D';
  process.env.PYTHONPATH = process.env.PYTHONPATH ? `${process.env.PYTHONPATH};${storageDParentPath}` : storageDParentPath;

  const pythonProcess = spawn('python', args);
  let stdout = '';
  let stderr = '';

  pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
  pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

  pythonProcess.on('close', (code) => {
    code === 0 ? resolve(stdout) : reject(new Error(stderr || 'Unknown error'));
  });

  pythonProcess.on('error', (err) => reject(new Error(`Failed to start Python process: ${err.message}`)));
});

// Basic server status check
app.get('/', (_req, res) => res.send('Server is running!'));

// ENCODE route
app.post('/encode', diskUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const toInt = (v, name) => {
      const n = Number(v);
      if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`);
      return n;
    };

    const opts = {
      encodedLength: toInt(req.body.encodedLength, 'encodedLength'),
      homopolymer: toInt(req.body.homopolymer, 'homopolymer'),
      minGC: toInt(req.body.minGC, 'minGC'),
      maxGC: toInt(req.body.maxGC, 'maxGC'),
      ecc: toInt(req.body.ecc, 'ecc'),
      flanking: req.body.flanking,
      redundancy: req.body.redundancy === 'true',
    };

    if (opts.encodedLength <= 0) throw new Error('encodedLength must be positive');
    if (opts.homopolymer <= 0) throw new Error('homopolymer must be positive');
    if (opts.minGC < 0 || opts.minGC > 100) throw new Error('minGC must be between 0 and 100');
    if (opts.maxGC < 0 || opts.maxGC > 100) throw new Error('maxGC must be between 0 and 100');
    if (opts.minGC > opts.maxGC) throw new Error('minGC must not exceed maxGC');
    if (opts.ecc < 0) throw new Error('ecc must be non-negative');
    if (!['Yes', 'No'].includes(opts.flanking)) throw new Error('flanking must be "Yes" or "No"');

    const scriptPath = path.resolve(__dirname, 'services', 'wk.py');
    const pythonArgs = [
      scriptPath, 'encode', req.file.path, opts.encodedLength, opts.homopolymer,
      opts.minGC, opts.maxGC, opts.ecc, opts.flanking, opts.redundancy,
    ].map(String);

    const pythonOutput = await runPythonScript(pythonArgs);
    const parsedResult = JSON.parse(pythonOutput);

    if (parsedResult.error) return res.status(400).json({ error: parsedResult.error });
    if (!Array.isArray(parsedResult.dnaStrands)) throw new Error('Unexpected output format: dnaStrands not an array');

    res.json({ dnaStrands: parsedResult.dnaStrands });
  } catch (err) {
    handleError(res, err);
  } finally {
    await cleanupFile(req.file?.path);
  }
});

// MODERATE route
app.post('/moderate', diskUpload.single('file'), async (req, res) => {
  try {
    const { contentType } = req.body;
    const requestHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${HIVE_API_KEY}`,
    };

    let requestBody = {};
    let apiUrl = '';
    let filePath = req.file?.path;

    if (contentType === 'text') {
      if (!req.body.content) throw new Error('No text content provided');
      requestBody = { input: [{ text: req.body.content }] };
      apiUrl = 'https://api.thehive.ai/api/v3/hive/text-moderation';
    } else {
      if (!req.file) throw new Error('No file provided');
      const fileBuffer = await fs.readFile(filePath);
      requestBody = { input: [{ media_base64: fileBuffer.toString('base64') }] };
      apiUrl = 'https://api.thehive.ai/api/v3/hive/visual-moderation';
    }

    console.log('Sending request to The Hive API v3...', { apiUrl, requestHeaders });
    console.log('Request body structure:', { input: [{ [contentType === 'text' ? 'text' : 'media_base64']: '[CONTENT_HIDDEN]' }] });

    const response = await axios.post(apiUrl, requestBody, { headers: requestHeaders });
    console.log('Full Response from The Hive API:', JSON.stringify(response.data, null, 2));

    if (!response.data.output?.length) throw new Error('Invalid or empty output from Hive API');

    const output = response.data.output[0];
    if (!output.classes?.length) throw new Error(`Invalid classes in ${contentType === 'text' ? 'text' : 'visual'} moderation output`);

    const classes = output.classes.map((cls) => ({ class: cls.class, score: cls.value }));
    const highestClass = classes.reduce((prev, curr) => prev.score > curr.score ? prev : curr, { score: -Infinity });

    const result = {
      class: highestClass.class,
      score: highestClass.score,
      allClasses: classes,
      raw: response.data,
    };

    console.log('Moderation result:', result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  } finally {
    await cleanupFile(req.file?.path);
  }
});

// UPLOAD route
app.post('/upload', memoryUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('No file provided');
    const { buffer, originalname } = req.file;
    console.log('Processing:', originalname);
    const { cid, digest, mongoId } = await storeModeratedFile(buffer, originalname);
    res.json({ ipfsHash: cid, fileId: mongoId, digest });
  } catch (err) {
    handleError(res, err);
  }
});

// FILE metadata route
app.get('/file/:id', async (req, res) => {
  try {
    const client = await MongoClient.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const file = await client.db('Databases').collection('files').findOne({ _id: new ObjectId(req.params.id) });
    await client.close();

    if (!file) return res.status(404).json({ error: 'File not found' });
    res.json({
      fileId: file._id.toString(),
      ipfsHash: file.cid,
      digest: file.digest,
      fileName: file.fileName,
    });
  } catch (err) {
    handleError(res, err);
  }
});

app.listen(port, () => console.log(`Backend running at http://localhost:${port}`));
