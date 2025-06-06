import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [file, setFile] = useState(null);
  const [moderationResult, setModerationResult] = useState(null);
  const [encodedDNA, setEncodedDNA] = useState('');
  const [digest, setDigest] = useState('');
  const [loading, setLoading] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [encodedLength, setEncodedLength] = useState(200);
  const [homopolymer, setHomopolymer] = useState(6);
  const [minGC, setMinGC] = useState(40);
  const [maxGC, setMaxGC] = useState(60);
  const [ecc, setEcc] = useState(0);
  const [flanking, setFlanking] = useState('No');
  const [redundancy, setRedundancy] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setModerationResult(null);
    setEncodedDNA('');
    setDigest('');
  };

  const submitModeration = async () => {
    if (!file) return alert('Please select a file');
    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const res = await axios.post(`http://localhost:3001/moderate`, formData);
      setModerationResult(res.data);
    } catch (err) {
      alert('Moderation failed');
    } finally {
      setLoading(false);
    }
  };

  const submitHash = async () => {
    if (!file || !moderationResult) return alert('Run moderation first');

    const body = {
      cid: 'mockCID', // Replace with real IPFS CID if needed
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      score: moderationResult.score,
    };

    try {
      const res = await axios.post('http://localhost:3001/hashhex', body);
      setDigest(res.data);
    } catch (err) {
      alert('Hash generation failed');
    }
  };

  const handleEncode = async () => {
    if (!file) return alert('Please select a file');

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
      const res = await axios.post('http://localhost:3001/encode', formData);
      setEncodedDNA(res.data);
    } catch (err) {
      alert('Encoding failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFile = async () => {
    await submitModeration();
    await handleEncode();
    await submitHash();
  };

  const handleToggleParams = () => {
    setShowParams(!showParams);
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center text-blue-700">Blockchain Data Storage</h1>

      <input
        type="file"
        onChange={handleFileChange}
        className="block w-full border rounded p-2"
      />

      <div className="flex flex-wrap gap-4 justify-center mt-4">
        <button
          onClick={handleUploadFile}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Upload & Process
        </button>
      </div>

      <div className="space-y-4">
        <button
          onClick={handleToggleParams}
          className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600"
        >
          {showParams ? 'Hide Parameters' : 'Encode DNA'}
        </button>

        {showParams && (
          <div className="space-y-3 p-4 border rounded bg-gray-50">
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col">
                Encoded Length
                <input
                  type="number"
                  value={encodedLength}
                  onChange={(e) => setEncodedLength(Number(e.target.value))}
                  className="p-2 border rounded"
                />
              </label>
              <label className="flex flex-col">
                Homopolymer
                <input
                  type="number"
                  value={homopolymer}
                  onChange={(e) => setHomopolymer(Number(e.target.value))}
                  className="p-2 border rounded"
                />
              </label>
              <label className="flex flex-col">
                Min GC%
                <input
                  type="number"
                  value={minGC}
                  onChange={(e) => setMinGC(Number(e.target.value))}
                  className="p-2 border rounded"
                />
              </label>
              <label className="flex flex-col">
                Max GC%
                <input
                  type="number"
                  value={maxGC}
                  onChange={(e) => setMaxGC(Number(e.target.value))}
                  className="p-2 border rounded"
                />
              </label>
              <label className="flex flex-col">
                ECC (RS)
                <input
                  type="number"
                  value={ecc}
                  onChange={(e) => setEcc(Number(e.target.value))}
                  className="p-2 border rounded"
                />
              </label>
              <label className="flex flex-col">
                Flanking Sequence
                <select
                  value={flanking}
                  onChange={(e) => setFlanking(e.target.value)}
                  className="p-2 border rounded"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </label>
              <label className="flex items-center space-x-2 col-span-2">
                <input
                  type="checkbox"
                  checked={redundancy}
                  onChange={(e) => setRedundancy(e.target.checked)}
                />
                <span>Redundancy</span>
              </label>
            </div>

            <button
              onClick={handleEncode}
              className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Submit DNA Encoding
            </button>
          </div>
        )}
      </div>

      {loading && <p className="text-center text-gray-600">Processing...</p>}
      {moderationResult && <p className="text-sm text-gray-700">Moderation Score: {moderationResult.score}</p>}
      {digest && <p className="text-sm text-gray-700">Hash Digest: {digest}</p>}
      {encodedDNA && (
        <div>
          <h2 className="font-semibold">Encoded DNA:</h2>
          <pre className="whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded">{encodedDNA}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
