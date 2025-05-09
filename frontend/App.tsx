// src/components/DNAUploader.tsx

import React, { useState } from 'react';
import {
  Box,
  Input,
  Button,
  InputLabel,
  Typography,
  TextField,
  InputAdornment,
  FormControlLabel,
  Radio,
  RadioGroup,
  Card,
  CardHeader,
  CardContent,
  LinearProgress, Checkbox
} from '@mui/material';

import {  Wallet, ethers } from 'ethers';
import DNAStorageABI from './abi/DNAStorage.json';
import ScoinABI from './abi/Scoin.json';
import axios from 'axios';


declare global {
  interface ImportMeta {
    env: {
      VITE_API_BASE_URL: string;
      // add other environment variables here
    };
  }
}

const DNAUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'direct' | 'dna'>('direct');
  const [strandLength, setStrandLength] = useState(100);
  const [homopolymer, setHomopolymer] = useState(3);
  const [gcContent, setGcContent] = useState(50);
  const [errorCorrection, setErrorCorrection] = useState(false);
  const [redundancy, setRedundancy] = useState(1);
  const [encodedDNA, setEncodedDNA] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ipfsCid, setIpfsCid] = useState('');
  const [transactionHash, setTransactionHash] = useState('');
  const [scoinBalance, setScoinBalance] = useState('');
  const [totalSupply, setTotalSupply] = useState('');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState({ipfsCid: '', transactionHash: '', scoinBalance: '', totalSupply: ''});
  const [showEncodedDNA, setShowEncodedDNA] = useState(false);


  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0]);
      setIsSubmitted(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setIsUploading(true);
  
    try {
      console.log('Starting upload process...');
      console.log('API Base URL:', API_BASE);
      console.log('File details:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // Test backend connection first
      try {
        console.log('Testing backend connection...');
        const testResponse = await axios.get(API_BASE);
        console.log('Backend connection test:', testResponse.data);
      } catch (testError: any) {
        console.error('Backend connection test failed:', testError.message);
        throw new Error('Cannot connect to backend server. Please ensure the backend is running at ' + API_BASE);
      }

      const modForm = new FormData();
      modForm.append('file', file);
      console.log('Sending moderation request...');
      const moderation = await axios.post(`${API_BASE}/api/moderation/moderate`, modForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
        timeout: 10000 // 10 second timeout
      });
      console.log('Moderation response:', moderation.data);
      
      if (!moderation.data.isAllowed) {
        alert('❌ File rejected by moderation.');
        setIsUploading(false);
        return;
      }
  
      let fileCid = '';
      let dnaCid = '';
  
      // Upload original file to IPFS
      console.log('Uploading to IPFS...');
      const fileForm = new FormData();
      fileForm.append('file', file);
      const fileUpload = await axios.post(`${API_BASE}/api/ipfs/store`, fileForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000 // 30 second timeout for file upload
      });
      console.log('IPFS upload response:', fileUpload.data);
      fileCid = fileUpload.data.cid;
  
      // Optional: DNA encoding and upload to IPFS
      if (uploadMethod === 'dna') {
        const dnaForm = new FormData();
        dnaForm.append('file', file);
        dnaForm.append('strandLength', strandLength.toString());
        dnaForm.append('homopolymer', homopolymer.toString());
        dnaForm.append('gcContent', gcContent.toString());
        dnaForm.append('redundancy', redundancy.toString());
        dnaForm.append('errorCorrection', errorCorrection ? 'true' : 'false');
  
        const response = await axios.post(`${API_BASE}/api/dna/encode-dna`, dnaForm);
        const data = response.data;
  
        if (!data.encoded) {
          alert('DNA encoding failed.');
          setIsUploading(false);
          return;
        }
  
        setEncodedDNA(data.encoded);
  
        const dnaBlob = new Blob([data.encoded], { type: 'text/plain' });
        const dnaFile = new File([dnaBlob], `${file.name}.dna.txt`, { type: 'text/plain' });
        const dnaUploadForm = new FormData();
        dnaUploadForm.append('file', dnaFile);
        const dnaUpload = await axios.post(`${API_BASE}/api/ipfs/store`, dnaUploadForm, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        dnaCid = dnaUpload.data.cid;
      } else {
        dnaCid = fileCid;
      }
  
      // Index both CIDs
      await axios.post(`${API_BASE}/api/ipfs/index`, {
        cid: fileCid,
        metadata: { title: file.name, creator: 'AppUser', type: 'original', timestamp: Date.now() }
      });
      if (uploadMethod === 'dna') {
        await axios.post(`${API_BASE}/api/ipfs/index`, {
          cid: dnaCid,
          metadata: { title: `${file.name}.dna`, creator: 'AppUser', type: 'encoded', timestamp: Date.now() }
        });
      }
  
      // Upload to blockchain
      const txResponse = await axios.post(`${API_BASE}/api/dna/upload`, {
        fileCid,
        dnaCid,
        filename: file.name
      });
  
      setUploadResult({
        ipfsCid: fileCid,
        transactionHash: txResponse.data.transactionHash,
        scoinBalance: txResponse.data.scoinBalance,
        totalSupply: txResponse.data.totalSupply
      });
  
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Upload error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        headers: err.response?.headers,
        config: {
          url: err.config?.url,
          method: err.config?.method,
          headers: err.config?.headers
        }
      });
      
      let errorMessage = 'Upload failed: ';
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage += `${err.response.status} - ${err.response.data?.message || err.message}`;
      } else if (err.request) {
        // The request was made but no response was received
        errorMessage += `No response from server at ${API_BASE}. Please check if the backend is running.`;
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage += err.message;
      }
      
      alert(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };  

  const resetForm = () => {
    setFile(null);
    setUploadMethod('direct');
    setStrandLength(100);
    setHomopolymer(3);
    setGcContent(50);
    setErrorCorrection(false);
    setRedundancy(1);
    setEncodedDNA('');
    setIsSubmitted(false);
    setIsUploading(false);
    setShowEncodedDNA(false);
    setUploadResult({ ipfsCid: '', transactionHash: '', scoinBalance: '', totalSupply: '' });
  };

  return (
    <Card className="dna-form-container mt-8">
      <CardHeader
        title="DATA STORAGE"
        subheader="Upload your file directly or encode it into synthetic DNA"
      />
      <CardContent>
        {!isSubmitted ? (
          // If NOT submitted, show the form
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Input */}
            <InputLabel htmlFor="file">File to Upload</InputLabel>
            <Input id="file" type="file" onChange={handleFileChange} fullWidth />
            {isUploading && <LinearProgress variant="indeterminate" sx={{ my: 2 }} />}
  
            {/* Upload Method */}
            <InputLabel>Upload Method</InputLabel>
            <RadioGroup
              value={uploadMethod}
              onChange={(e) => setUploadMethod(e.target.value as 'direct' | 'dna')}
              row
            >
              <FormControlLabel value="direct" control={<Radio />} label="Direct Upload" />
              <FormControlLabel value="dna" control={<Radio />} label="DNA Encoding" />
            </RadioGroup>
  
            {/* DNA Parameters (if selected) */}
            {uploadMethod === 'dna' && (
              <Box className="space-y-4">
                <Typography variant="h6" gutterBottom>
                  DNA Encoding Parameters
                </Typography>
                <TextField
                  label="Strand Length"
                  type="number"
                  value={strandLength}
                  onChange={(e) => setStrandLength(Number(e.target.value))}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">bp</InputAdornment>,
                    inputProps: { step: 1 }
                  }}
                />
                <TextField
                  label="Homopolymer"
                  type="number"
                  value={homopolymer}
                  onChange={(e) => setHomopolymer(Number(e.target.value))}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">bp</InputAdornment>,
                    inputProps: { step: 1 }
                  }}
                />
                <TextField
                  label="GC Content"
                  type="number"
                  value={gcContent}
                  onChange={(e) => setGcContent(Number(e.target.value))}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    inputProps: { step: 1 }
                  }}
                />
                <TextField
                  label="Redundancy"
                  type="number"
                  value={redundancy}
                  onChange={(e) => setRedundancy(Number(e.target.value))}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    inputProps: { step: 0.1 }
                  }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={errorCorrection}
                      onChange={(e) => setErrorCorrection(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Error Correction"
                />
            {encodedDNA && (
                  <>
                    <Button variant="outlined" fullWidth onClick={() => setShowEncodedDNA(!showEncodedDNA)}>
                      {showEncodedDNA ? 'Hide Encoded DNA' : 'View Encoded DNA'}
                    </Button>
                    {showEncodedDNA && (
                      <Box className="dna-strands" sx={{ mt: 2 }}>
                        <Typography variant="h6">DNA STRANDS</Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{encodedDNA}</Typography>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            )}

            {/* Submit & Reset Buttons */}
            <Box mt={2} display="flex" justifyContent="space-between">
              <Button variant="outlined" onClick={resetForm}>
                Reset
              </Button>
              <Button variant="contained" type="submit" disabled={!file || isUploading}>
                {isUploading ? 'Uploading...' : 'Upload File'}
              </Button>
            </Box>
          </form>
        ) : (
          // If submitted, show results
          <div className="space-y-4">
            <Typography variant="h6" gutterBottom>
              Upload Complete
            </Typography>
            <Typography>IPFS CID: {uploadResult.ipfsCid}</Typography>
            <Typography>Transaction Hash: {uploadResult.transactionHash}</Typography>
            {uploadResult.scoinBalance && (
              <Typography>Scoin Balance: {uploadResult.scoinBalance}</Typography>
            )}
            {uploadResult.totalSupply && (
              <Typography>Total Scoin: {uploadResult.totalSupply}</Typography>
            )}
  
            {/* Post-submission Actions */}
            <Box mt={2} display="flex" gap={2}>
              <Button onClick={resetForm} variant="outlined" fullWidth>
                Upload Another File
              </Button>
              <Button variant="contained" fullWidth>
                View Details
              </Button>
            </Box>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DNAUploader;