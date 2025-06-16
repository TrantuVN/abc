const express = require('express');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { unlink } = require('fs/promises');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { ethers } = require('ethers'); 

const storeModeratedFile = require('./services/IPFSindex.js'); 

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Basic server status check
app.get('/', (_req, res) => {
  res.send('Server is running!');
});

/**
 * Helper function to run Python scripts.
 * @param {string[]} args - Arguments to pass to the Python script.
 * @returns {Promise<string>} - Python script's stdout.
 */
async function runPythonScript(args) {
  return new Promise((resolve, reject) => {
    const storageDParentPath = 'C:\\Users\\Multiplexon\\Desktop\\thesis\\Scoin - Copy\\Storage-D';
    process.env.PYTHONPATH = process.env.PYTHONPATH
      ? `${process.env.PYTHONPATH};${storageDParentPath}`
      : storageDParentPath;

    const pythonProcess = spawn('python', args);
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        console.error(`Python script exited with code ${code}. Stderr: ${stderr}`);
        reject(new Error(`Python script failed: ${stderr || 'Unknown error'}`));
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

// ENCODE - Main API route for file encoding
app.post('/encode', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const toInt = (v, name) => {
    const n = Number(v);
    if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`);
    return n;
  };

  let opts;
  try {
    opts = {
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
  } catch (err) {
    await unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: err.message });
  }

  const scriptPath = path.resolve(__dirname, 'services', 'wk.py');
  const pythonArgs = [
    scriptPath,
    'encode',
    req.file.path,
    opts.encodedLength,
    opts.homopolymer,
    opts.minGC,
    opts.maxGC,
    opts.ecc,
    opts.flanking,
    opts.redundancy,
  ].map(String);

  try {
    const pythonOutput = await runPythonScript(pythonArgs);
    const parsedResult = JSON.parse(pythonOutput);

    if (parsedResult.error) {
      return res.status(400).json({ error: parsedResult.error });
    }
    if (!Array.isArray(parsedResult.dnaStrands)) {
      return res.status(500).json({ error: 'Unexpected output format: dnaStrands not an array' });
    }
    res.json({ dnaStrands: parsedResult.dnaStrands });
  } catch (err) {
    console.error('Encoding process error:', err);
    try {
      const parsedPythonError = JSON.parse(err.message.replace('Python script failed: ', ''));
      if (parsedPythonError.error) {
        return res.status(400).json({ error: parsedPythonError.error });
      }
    } catch (parseErr) {}
    res.status(500).json({ error: 'Encoding process failed: ' + err.message });
  } finally {
    await unlink(req.file.path).catch((deleteErr) => console.error('File deletion error:', deleteErr));
  }
});


// The Hive API credentials
const HIVE_API_KEY = 'tpLvzIMIVc5YpBs1EJYQLA==';
console.log(HIVE_API_KEY)

// API endpoint for content moderation
app.post("/moderate", upload.single("file"), async (req, res) => {
  try {
    const { contentType } = req.body;

    const requestHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HIVE_API_KEY}`, // Current method
      // Alternatively, test with API key in a custom header if required
      // 'x-api-key': HIVE_API_KEY, // Uncomment and test if needed
    };

    let requestBody = {};
    let apiUrl = "";

    if (contentType === "text") {
      const content = req.body.content;
      if (!content) {
        return res.status(400).json({ error: "No text content provided" });
      }
      requestBody = { input: [{ text: content }] };
      apiUrl = "https://api.thehive.ai/api/v3/hive/text-moderation";
    } else {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }
      const fileBuffer = fs.readFileSync(file.path);
      const base64 = fileBuffer.toString("base64");
      requestBody = { input: [{ media_base64: base64 }] };
      apiUrl = "https://api.thehive.ai/api/v3/hive/visual-moderation";
      fs.unlinkSync(file.path);
    }

    console.log("Sending request to The Hive API v3...");
    console.log("API URL:", apiUrl);
    console.log("Request headers:", requestHeaders);
    console.log("Request body structure:", {
      input: [{ [contentType === "text" ? "text" : "media_base64"]: "[CONTENT_HIDDEN]" }],
    });

    const response = await axios.post(apiUrl, requestBody, {
      headers: requestHeaders,
    });

    console.log("Full Response from The Hive API:", JSON.stringify(response.data, null, 2));

    const output = response.data?.output?.[0];
    if (!output) {
      console.warn("No output found in Hive API response:", response.data);
      return res.status(400).json({ error: "No moderation output received", raw: response.data });
    }

    let result = { allClasses: [], raw: response.data };
    let classes = [];

    if (contentType === "text" && Array.isArray(output.classes)) {
      classes = output.classes.map((cls) => ({
        class: cls.class,
        score: cls.value,
      }));
    } else if (contentType !== "text" && output.predictions?.[0]?.classes) {
      const predictionClasses = output.predictions[0].classes;
      classes = Object.entries(predictionClasses).map(([cls, score]) => ({
        class: cls,
        score: score,
      }));
    } else {
      console.warn("Unexpected output structure:", output);
      result.error = "Unexpected moderation output format";
    }

    if (classes.length > 0) {
      const highestClass = classes.reduce((prev, current) =>
        prev.score > current.score ? prev : current
      );
      result = {
        class: highestClass.class,
        score: highestClass.score,
        allClasses: classes,
        raw: response.data,
      };
    } else if (!result.error) {
      console.warn("No classes found in Hive API response:", output);
      result.error = "No moderation classes found";
    }

    console.log("Moderation result:", result);
    res.json(result);
  } catch (error) {
    console.error("Server error:", error.message);
    if (error.response) {
      console.error("API Response Status:", error.response.status);
      console.error("API Response Data:", JSON.stringify(error.response.data, null, 2));
      if (error.response.status === 401) {
        return res.status(401).json({
          error: "Unauthorized API key",
          details: error.response.data,
          message: "Please verify your HIVE_API_KEY and ensure it has the correct permissions.",
        });
      }
      res.status(error.response.status).json({
        error: "Error from moderation service",
        details: error.response.data,
        message: error.response.data?.message || "API request failed",
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  }
});
// IPFS UPLOAD - API route to upload and store moderated files on IPFS
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { path, originalname: fileName, mimetype: fileType } = req.file;
    const buffer = fs.readFileSync(path);
    console.log(`Processing: ${fileName}`);

    // Upload IPFS, lưu MongoDB
    const { cid, digest, mongoId } = await storeModeratedFile(buffer, fileName, fileType);

    // Xóa file tạm
    fs.unlinkSync(path);

    // Trả kết quả
    res.json({ fileId: mongoId, ipfsHash: cid, digest, fileName });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});
// API lấy metadata
app.get('/file/:id', async (req, res) => {
  try {
    const { MongoClient, ObjectId } = require('mongodb');
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017', { useNewUrlParser: true, useUnifiedTopology: true });
    const file = await client.db('Databases').collection('files').findOne({ _id: new ObjectId(req.params.id) });
    await client.close();

    if (!file) return res.status(404).json({ error: 'File not found' });
    res.json({ fileId: file._id.toString(), ipfsHash: file.cid, digest: file.digest, fileName: file.fileName, fileType: file.fileType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});