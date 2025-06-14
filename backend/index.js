const express = require('express');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { unlink } = require('fs/promises');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const storeModeratedFile = require('./services/IPFSindex'); // Assuming this handles IPFS client creation internally

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });

// The Hive API credentials
const HIVE_API_KEY = "CzlyTS6RdJ2IlMsN7w+p3Q==";

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
    // Ensure this path points to the parent directory of 'StorageD'
    const storageDParentPath = 'C:\\Users\\Multiplexon\\Desktop\\thesis\\Scoin - Copy\\Storage-D';

    // Set PYTHONPATH
    process.env.PYTHONPATH = process.env.PYTHONPATH ?
      `${process.env.PYTHONPATH};${storageDParentPath}` :
      storageDParentPath;

    const pythonProcess = spawn('python', args);
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

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

// 🧬 ENCODE - Main API route for file encoding
app.post('/encode', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Helper to convert to integer, with validation
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
      flanking: req.body.flanking, // 'Yes' or 'No' string
      redundancy: req.body.redundancy === 'true',
    };
  } catch (err) {
    await unlink(req.file.path).catch(() => {}); // Clean up file on validation error
    return res.status(400).json({ error: err.message });
  }

  // Build arguments for the Python script
  const scriptPath = path.resolve(__dirname, 'services', 'wk.py');
  const pythonArgs = [
    scriptPath,
    'encode', // "mode" argument for CLI
    req.file.path,
    opts.encodedLength,
    opts.homopolymer,
    opts.minGC,
    opts.maxGC,
    opts.ecc, // used as rs_num in Python
    opts.flanking,
    opts.redundancy,
  ].map(String); // Ensure all args are strings for spawn

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
    // Attempt to parse error from Python stderr if it's JSON
    try {
      const parsedPythonError = JSON.parse(err.message.replace('Python script failed: ', ''));
      if (parsedPythonError.error) {
        return res.status(400).json({ error: parsedPythonError.error });
      }
    } catch (parseErr) {
      // Not a JSON error from Python, return general error
    }
    res.status(500).json({ error: 'Encoding process failed: ' + err.message });
  } finally {
    // Always clean up the uploaded file
    await unlink(req.file.path).catch(deleteErr => console.error('File deletion error:', deleteErr));
  }
});

// MODERATE - API route for content moderation (file or text)
app.post('/detect', upload.single('file'), async (req, res) => {
  try {
    const { contentType } = req.body;

    const requestHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HIVE_API_KEY}`,
    };

    let requestBody = {};
    let apiUrl = "";

    // Handle different content types with API v3 structure
    if (contentType === "text") {
      const content = req.body.content;
      if (!content) {
        return res.status(400).json({ error: "No text content provided" });
      }

      // Request structure for text moderation API v3
      requestBody = {
        input: [
          {
            text: content,
          },
        ],
      };
      apiUrl = "https://api.thehive.ai/api/v3/hive/text-moderation";
    } else {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Convert file to base64
      const fileBuffer = fs.readFileSync(file.path);
      const base64 = fileBuffer.toString("base64");

      // Request structure for visual moderation API v3 (for both image and video)
      requestBody = {
        input: [
          {
            media_base64: base64,
          },
        ],
      };
      apiUrl = "https://api.thehive.ai/api/v3/hive/visual-moderation";

      // Clean up uploaded file
      fs.unlinkSync(file.path);
    }

    console.log("Sending request to The Hive API v3...");
    console.log("API URL:", apiUrl);
    console.log("Request body structure:", {
      input: [
        {
          [contentType === "text" ? "text" : "media_base64"]: "[CONTENT_HIDDEN]",
        },
      ],
    });

    // Send to The Hive Moderation API v3
    const response = await axios.post(apiUrl, requestBody, {
      headers: requestHeaders,
      timeout: 60000, // 60 seconds
    });

    // Process the response from The Hive API v3
    let result = {
      class: "unknown",
      score: 0,
      allClasses: [],
    };
    const output = response.data?.output?.[0];
    console.log("output::", output);
    if (response.data?.output?.[0]) {
      result = {
        class: "Success",
        raw: response.data?.output?.[0],
      };
    } else {
      result = {
        class: "error",
        raw: response.data,
      };
    }

    res.json(result);
  } catch (error) {
    console.error("Server error:", error.message);
    if (error.response) {
      console.error("API Response Status:", error.response.status);
      console.error("API Response Data:", JSON.stringify(error.response.data, null, 2));
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

// IPFS UPLOAD - API route to upload and store files on IPFS
app.post('/upload-and-store', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');

  try {
    const buffer = fs.readFileSync(req.file.path);
    const { digest } = await storeModeratedFile(buffer, req.file.originalname, req.file.mimetype);
    res.type('text/plain').send(digest);
  } catch (err) {
    console.error('Store & Index error:', err);
    res.status(500).type('text/plain').send(`Store & Index failed: ${err.message}`);
  } finally {
    await unlink(req.file.path).catch(err => console.error('File deletion error:', err));
  }
});

// HASH - API route to generate a SHA256 hash of metadata
app.post('/hashhex', async (req, res) => {
  const { cid, fileName, fileType, fileSize, score } = req.body;

  if (!cid || !fileName || !fileType || fileSize == null || score == null) {
    return res.status(400).type('text/plain').send('Missing required fields');
  }

  try {
    const raw = JSON.stringify({ cid, fileName, fileType, fileSize, score });
    const digest = crypto.createHash('sha256').update(raw).digest('hex');
    res.type('text/plain').send(digest);
  } catch (err) {
    console.error('Hash generation error:', err);
    res.status(500).type('text/plain').send('Hash generation failed');
  }
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});