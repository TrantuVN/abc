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
      const res = await axios.post('http://localhost:3000/moderate', formData, { timeout: 60000 });
      const { error: modError, class: cls, score, allClasses = [], raw = {} } = res.data;
      setModerationResult({ class: cls, score, allClasses, raw });
      if (modError) {
        setError(modError);
        return false;
      }
      return true;
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message || 'Moderation failed';
      setError(err.response?.status === 401 ? 'Unauthorized API key. Please check your HIVE_API_KEY.' : message);
      setModerationResult({ raw: err.response?.data || {} });
      return true;
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
      const res = await axios.post('http://localhost:3000/upload', formData, { timeout: 120000 });
      setIpfsHash(res.data.ipfsHash);
      setFileId(res.data.fileId);
      setDigest(res.data.digest);
      return res.data.digest;
    } catch (err) {
      setError(err.response?.data?.error || `IPFS upload failed: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const submitHash = async (digest) => {
    if (!file || !ipfsHash) {
      return false;
    }
    try {
      setLoading(true);
      setError('');
      setDigest(digest);
      return true;
    } catch (err) {
      setError('Hash processing failed: ' + err.message);
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
    if (encodedLength <= 0 || homopolymer <= 0 || minGC < 0 || minGC > 100 || maxGC < 0 || maxGC > 100 || minGC > maxGC) {
      setError('Invalid encoding parameters.');
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
        setError('Unexpected response from encoder.');
        setEncodedDNA('');
      }
      return true;
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Encoding failed');
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
        console.log('Moderation failed, continuing upload');
      }

      const digest = await submitUploadToIPFS();
      if (!digest) {
        console.log('IPFS upload failed, stopping');
        return;
      }

      const hashed = await submitHash(digest);
      if (!hashed) {
        console.log('Hash processing failed, stopping');
        return;
      }
    } catch (err) {
      setError('Upload failed: ' + (err.message || 'Unknown error'));
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
  <div style={{ marginTop: '2rem', maxWidth: '700px', color: 'white' }}>
    <h3 style={{ marginBottom: '1rem' }}>Encoding Parameters</h3>
    <table style={{ width: '100%', borderSpacing: '0.75rem 0.5rem' }}>
      <tbody>
        <tr>
          <td><label>Encoded Length:</label></td>
          <td><input type="number" value={encodedLength} onChange={(e) => setEncodedLength(Number(e.target.value))} /></td>
          <td><label>Homopolymer Limit:</label></td>
          <td><input type="number" value={homopolymer} onChange={(e) => setHomopolymer(Number(e.target.value))} /></td>
        </tr>
        <tr>
          <td><label>Min GC%:</label></td>
          <td><input type="number" value={minGC} onChange={(e) => setMinGC(Number(e.target.value))} /></td>
          <td><label>Max GC%:</label></td>
          <td><input type="number" value={maxGC} onChange={(e) => setMaxGC(Number(e.target.value))} /></td>
        </tr>
        <tr>
          <td><label>ECC:</label></td>
          <td><input type="number" value={ecc} onChange={(e) => setEcc(Number(e.target.value))} /></td>
          <td><label>Flanking:</label></td>
          <td>
            <select value={flanking} onChange={(e) => setFlanking(e.target.value)}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </td>
        </tr>
        <tr>
          <td colSpan={4}>
            <label>
              <input type="checkbox" checked={redundancy} onChange={() => setRedundancy(!redundancy)} /> Redundancy
            </label>
          </td>
        </tr>
        <tr>
          <td colSpan={4} style={{ textAlign: 'center', paddingTop: '1rem' }}>
            <button onClick={handleEncode} disabled={loading}>ENCODE</button>
          </td>
        </tr>
      </tbody>
    </table>
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
  <div style={{ marginTop: '2rem', maxWidth: '700px' }}>
    <h3 style={{ marginBottom: '1rem', color: 'white' }}>Upload Results</h3>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {ipfsHash && (
          <tr>
            <td style={{ color: 'white', fontWeight: 'bold', paddingRight: '1rem', textAlign: 'left', verticalAlign: 'top' }}>IPFS CID:</td>
            <td style={{ color: 'white', backgroundColor: '#222', padding: '4px 8px', borderRadius: '4px', wordBreak: 'break-all' }}>{ipfsHash}</td>
          </tr>
        )}
        {fileId && (
          <tr>
            <td style={{ color: 'white', fontWeight: 'bold', paddingRight: '1rem', textAlign: 'left', verticalAlign: 'top' }}>MongoID:</td>
            <td style={{ color: 'white', backgroundColor: '#222', padding: '4px 8px', borderRadius: '4px', wordBreak: 'break-all' }}>{fileId}</td>
          </tr>
        )}
        {digest && (
          <tr>
            <td style={{ color: 'white', fontWeight: 'bold', paddingRight: '1rem', textAlign: 'left', verticalAlign: 'top' }}>Hash:</td>
            <td style={{ color: 'white', backgroundColor: '#222', padding: '4px 8px', borderRadius: '4px', wordBreak: 'break-all' }}>{digest}</td>
          </tr>
        )}
      </tbody>
    </table>

    {moderationResult?.raw && (
      <div style={{ marginTop: '1rem' }}>
        <strong style={{ color: 'white' }}>Raw Output:</strong>
        <textarea
          value={JSON.stringify(moderationResult.raw, null, 2)}
          rows={10}
          readOnly
          style={{ width: '100%', fontFamily: 'monospace', backgroundColor: '#111', color: 'white', padding: '0.5rem', borderRadius: '5px', fontSize: '0.85rem', marginTop: '0.5rem' }}
        />
      </div>
    )}
  </div>
)}
    </div>
  );
  }
export default App;
