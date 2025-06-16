import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [moderationResult, setModerationResult] = useState(null);
  const [encodedDNA, setEncodedDNA] = useState('');
  const [ipfsHash, setIpfsHash] = useState('');
  const [digest, setDigest] = useState('');
  const [fileId, setFileId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showParams, setShowParams] = useState(false);
  const [encodedLength, setEncodedLength] = useState(200);
  const [homopolymer, setHomopolymer] = useState(6);
  const [minGC, setMinGC] = useState(40);
  const [maxGC, setMaxGC] = useState(60);
  const [ecc, setEcc] = useState(0);
  const [flanking, setFlanking] = useState('No');
  const [redundancy, setRedundancy] = useState(false);

  const resetState = () => {
    setModerationResult(null);
    setEncodedDNA('');
    setIpfsHash('');
    setDigest('');
    setFileId('');
    setError('');
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    resetState();
  };

  const submitModeration = async () => {
    if (!file) {
      setError('Please select a file');
      return false;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contentType', 'file');

    try {
      setLoading(true);
      setError('');
      console.log('Sending request to /moderate with formData:', [...formData.entries()]);
      const res = await axios.post('http://localhost:3000/moderate', formData, { timeout: 60000 });
      console.log('Moderation response:', res.data);

      const { error: modError, class: cls, score, allClasses = [], raw = {} } = res.data;
      setModerationResult({ class: cls, score, allClasses, raw });
      if (modError) {
        setError(modError);
        return false;
      }
      return true;
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message || 'Moderation failed';
      console.error('Moderation error:', err);
      if (err.response?.status === 401) {
        setError('Unauthorized API key. Please check your HIVE_API_KEY and permissions.');
      } else {
        setError(message);
      }
      setModerationResult({ raw: err.response?.data || {} }); // Lưu raw để debug
      return true; // Tiếp tục nếu muốn bỏ qua lỗi
    } finally {
      setLoading(false);
    }
  };

  const submitUploadToIPFS = async () => {
    if (!file) {
      setError('Please select a file');
      return null;
    }
    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      setError('');
      console.log('Sending request to /upload with formData:', [...formData.entries()]);
      const res = await axios.post('http://localhost:3000/upload', formData, { timeout: 120000 });
      console.log('IPFS upload response:', res.data);
      setIpfsHash(res.data.ipfsHash);
      setFileId(res.data.fileId);
      setDigest(res.data.digest);
      return res.data.digest;
    } catch (err) {
      console.error('IPFS upload error details:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        code: err.code,
      });
      const errorMessage = err.response?.data?.error || `IPFS upload failed: ${err.message}`;
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const submitHash = async (digest) => {
    if (!file || !ipfsHash) {
      setError('Run IPFS upload first');
      return false;
    }
    try {
      setLoading(true);
      setError('');
      setDigest(digest);
      return true;
    } catch (err) {
      setError('Hash processing failed: ' + (err.message || 'Unknown error'));
      console.error('Hash processing error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleEncode = async () => {
    if (!file) {
      setError('Please select a file');
      return false;
    }
    if (
      encodedLength <= 0 ||
      homopolymer <= 0 ||
      minGC < 0 ||
      minGC > 100 ||
      maxGC < 0 ||
      maxGC > 100 ||
      minGC > maxGC
    ) {
      setError('Invalid encoding parameters. Please check the values.');
      return false;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('encodedLength', encodedLength);
    formData.append('homopolymer', homopolymer);
    formData.append('minGC', minGC);
    formData.append('maxGC', maxGC);
    formData.append('ecc', ecc);
    formData.append('flanking', flanking);
    formData.append('redundancy', redundancy);

    try {
      setLoading(true);
      setError('');
      const res = await axios.post('http://localhost:3000/encode', formData, { timeout: 60000 });
      console.log('Encode response:', res.data);
      if (res.data && Array.isArray(res.data.dnaStrands)) {
        setEncodedDNA(res.data.dnaStrands.join('\n'));
      } else {
        setError('Unexpected response format from encoder.');
        setEncodedDNA('');
      }
      return true;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Encoding failed';
      setError(errorMessage);
      console.error('Encode error:', err);
      setEncodedDNA('');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFile = async () => {
    try {
      setLoading(true);
      setError('');
      setIpfsHash('');
      setDigest('');
      setFileId('');
      setEncodedDNA('');
      setModerationResult(null);

      const moderated = await submitModeration();
      if (!moderated) {
        console.log('Moderation failed, but continuing upload process');
        // return; // Bỏ comment nếu muốn dừng khi moderation thất bại
      }

      const digest = await submitUploadToIPFS();
      if (!digest) {
        console.log('IPFS upload failed, stopping upload process');
        return;
      }

      const hashed = await submitHash(digest);
      if (!hashed) {
        console.log('Hash processing failed, stopping upload process');
        return;
      }

      console.log('Upload process completed successfully');
    } catch (err) {
      setError('Upload process failed: ' + (err.message || 'Unknown error'));
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Blockchain Data Storage</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <input type="file" onChange={handleFileChange} />
      <div style={{ marginTop: '1rem' }}>
        <button onClick={handleUploadFile} disabled={loading}>Upload File</button>
        <button onClick={resetState} disabled={loading}>Reset</button>
      </div>

      {loading && <p style={{ color: 'orange' }}>⏳ Processing...</p>}

      <div style={{ marginTop: '1rem' }}>
        <label>
          <input type="radio" name="uploadType" checked={showParams} onChange={() => setShowParams(true)} />
          Encode DNA Strands
        </label>
        <label style={{ marginLeft: '1rem' }}>
          <input type="radio" name="uploadType" checked={!showParams} onChange={() => setShowParams(false)} />
          Upload Directly
        </label>
      </div>

      {showParams && (
        <div className="encoding-parameters-grid" style={{ marginTop: '1rem' }}>
          <h3>Encoding Parameters</h3>
          <label>
            Encoded Length: <input type="number" value={encodedLength} onChange={(e) => setEncodedLength(Number(e.target.value))} />
          </label>
          <label>
            Homopolymer Limit: <input type="number" value={homopolymer} onChange={(e) => setHomopolymer(Number(e.target.value))} />
          </label>
          <label>
            Min GC%: <input type="number" value={minGC} onChange={(e) => setMinGC(Number(e.target.value))} />
          </label>
          <label>
            Max GC%: <input type="number" value={maxGC} onChange={(e) => setMaxGC(Number(e.target.value))} />
          </label>
          <label>
            ECC (Error Correction Code): <input type="number" value={ecc} onChange={(e) => setEcc(Number(e.target.value))} />
          </label>
          <label>
            Flanking (Add Primer):{' '}
            <select value={flanking} onChange={(e) => setFlanking(e.target.value)}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            <input type="checkbox" checked={redundancy} onChange={() => setRedundancy(!redundancy)} />
            Redundancy
          </label>
          <div style={{ marginTop: '1rem', gridColumn: '1 / -1' }}>
            <button onClick={handleEncode} disabled={loading}>
              ENCODE
            </button>
          </div>
        </div>
      )}

      {encodedDNA && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Encoded DNA Strands</h3>
          <textarea value={encodedDNA} rows={10} readOnly style={{ width: '100%', fontFamily: 'monospace' }} />
        </div>
      )}

      {showParams && !encodedDNA && !loading && (
        <p style={{ color: 'gray', marginTop: '2rem' }}>No DNA output yet. Click ENCODE.</p>
      )}

      {(ipfsHash || digest || fileId || moderationResult) && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Upload Results</h3>
          {ipfsHash && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>CID (IPFS Hash):</strong>
              <pre style={{ display: 'inline', marginLeft: '0.5rem' }}>{ipfsHash}</pre>
            </div>
          )}
          {fileId && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>MongoID (File ID):</strong>
              <pre style={{ display: 'inline', marginLeft: '0.5rem' }}>{fileId}</pre>
            </div>
          )}
          {digest && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>Hash (Digest):</strong>
              <pre style={{ display: 'inline', marginLeft: '0.5rem' }}>{digest}</pre>
            </div>
          )}
          {moderationResult?.raw && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>Raw Output:</strong>
              <textarea
                value={JSON.stringify(moderationResult.raw, null, 2)}
                rows={10}
                readOnly
                style={{ width: '100%', fontFamily: 'monospace', marginTop: '0.5rem' }}
              />
            </div>
          )}
          {moderationResult?.class && moderationResult?.score && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>Moderation Class:</strong> {moderationResult.class}
              <br />
              <strong>Moderation Score:</strong> {moderationResult.score.toFixed(4)}
            </div>
          )}
          {moderationResult?.allClasses?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <strong>All Classes:</strong>
              <ul>
                {moderationResult.allClasses.map((cls, index) => (
                  <li key={index}>
                    {cls.class}: {cls.score.toFixed(4)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;