
import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [moderationResult, setModerationResult] = useState(null);
  const [encodedDNA, setEncodedDNA] = useState('');
  const [digest, setDigest] = useState('');
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
    setDigest('');
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
      const res = await axios.post('http://localhost:3000/moderate', formData);
      console.log('Moderation response:', res.data);

      const { class: cls, score = 0 } = res.data;
      setModerationResult({ class: cls, score });
      return true;
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message || 'Moderation failed';
      console.error('Moderation error:', err);
      setError(message);
      return false;
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
      const res = await axios.post('http://localhost:3000/upload-and-store', formData);
      return res.data.digest;
    } catch (err) {
      setError(err.response?.data?.error || 'IPFS upload failed');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const submitHash = async (digest) => {
    if (!file || !moderationResult) {
      setError('Run moderation first');
      return false;
    }

    const body = {
      cid: digest,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };

    try {
      setLoading(true);
      setError('');
      const res = await axios.post('http://localhost:3000/hashhex', body);
      setDigest(res.data.digest);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Hash generation failed');
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
      const res = await axios.post('http://localhost:3000/encode', formData);
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
      setDigest('');
      setEncodedDNA('');

      const moderated = await submitModeration();
      if (!moderated) return;

      const digest = await submitUploadToIPFS();
      if (!digest) return;

      await submitHash(digest);
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
          <label>Encoded Length: <input type="number" value={encodedLength} onChange={(e) => setEncodedLength(Number(e.target.value))} /></label>
          <label>Homopolymer Limit: <input type="number" value={homopolymer} onChange={(e) => setHomopolymer(Number(e.target.value))} /></label>
          <label>Min GC%: <input type="number" value={minGC} onChange={(e) => setMinGC(Number(e.target.value))} /></label>
          <label>Max GC%: <input type="number" value={maxGC} onChange={(e) => setMaxGC(Number(e.target.value))} /></label>
          <label>ECC (Error Correction Code): <input type="number" value={ecc} onChange={(e) => setEcc(Number(e.target.value))} /></label>
          <label>Flanking (Add Primer): <select value={flanking} onChange={(e) => setFlanking(e.target.value)}><option value="No">No</option><option value="Yes">Yes</option></select></label>
          <label style={{ gridColumn: '1 / -1' }}>
            <input type="checkbox" checked={redundancy} onChange={() => setRedundancy(!redundancy)} />
            Redundancy
          </label>
          <div style={{ marginTop: '1rem', gridColumn: '1 / -1' }}>
            <button onClick={handleEncode} disabled={loading}>ENCODE</button>
          </div>
        </div>
      )}

      {encodedDNA ? (
        <div style={{ marginTop: '2rem' }}>
          <h3>Encoded DNA Strands</h3>
          <textarea value={encodedDNA} rows={10} readOnly style={{ width: '100%', fontFamily: 'monospace' }} />
        </div>
      ) : (
        showParams && !loading && <p style={{ color: 'gray' }}>No DNA output yet. Click ENCODE.</p>
      )}

      <div style={{ marginTop: '2rem' }}>
        {digest && (
          <>
            <h3>HashHex Result</h3>
            <pre>{digest}</pre>
            <button onClick={() => navigator.clipboard.writeText(digest)}>Copy Hash</button>
          </>
        )}

        {moderationResult && (
          <>
            <h3>Moderation Result</h3>
            <p><strong>Class:</strong> {moderationResult.class}</p>
            <p><strong>Score:</strong> {moderationResult.score !== undefined ? moderationResult.score.toFixed(4) : 'N/A'}</p>
          </>
        )}
      </div>

      {digest && (
        <div style={{ marginTop: '2rem' }}>
          <button onClick={() => alert('Transaction executed')} disabled={loading}>Transactions</button>
          <button onClick={() => alert('Canceled')} disabled={loading}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default App;