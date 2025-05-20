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
  LinearProgress,
  Checkbox
} from '@mui/material';
import { ethers } from 'ethers';
import axios from 'axios';

const App: React.FC = () => {
  const [SelectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'direct' | 'dna'>('direct');
  const [strandLength, setStrandLength] = useState(100);
  const [homopolymer, setHomopolymer] = useState(3);
  const [gcContent, setGcContent] = useState(50);
  const [errorCorrection, setErrorCorrection] = useState(false);
  const [redundancy, setRedundancy] = useState(1);
  const [encodedDNA, setEncodedDNA] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showEncodedDNA, setShowEncodedDNA] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [digestIpfs, setDigestIpfs] = useState('');  // updated from boolean to string

  const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  const resetForm = () => {
    setSelectedFile(null);
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
    setDigestIpfs('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setSelectedFile(e.target.files[0]);
      setIsSubmitted(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!SelectedFile) return;

    setIsUploading(true);

    try {
      const moderationForm = new FormData();
      moderationForm.append('file', SelectedFile);

      const moderationResponse = await axios.post(`${API_BASE}/moderate-score`, moderationForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,

      });

      if (!moderationResponse.data.isAllowed) {
        alert('File rejected by moderation.');
        setIsUploading(false);
        return;
      }

      const ipfsFormData = new FormData();
      ipfsFormData.append('file', SelectedFile);

      const ipfsUploadResponse = await axios.post(`${API_BASE}/digest-ipfs`, ipfsFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const digest = ipfsUploadResponse.data.digest || '';
      setDigestIpfs(digest);  // store digest into state

      if (uploadMethod === 'dna') {
        const dnaEncodingFormData = new FormData();
        dnaEncodingFormData.append('file', SelectedFile);
        dnaEncodingFormData.append('strandLength', strandLength.toString());
        dnaEncodingFormData.append('homopolymer', homopolymer.toString());
        dnaEncodingFormData.append('gcContent', gcContent.toString());
        dnaEncodingFormData.append('redundancy', redundancy.toString());
        dnaEncodingFormData.append('errorCorrection', errorCorrection ? 'true' : 'false');

        const encodeResponse = await axios.post(`${API_BASE}/encode-dna`, dnaEncodingFormData);
        const dnaResponse = encodeResponse.data;

        if (!dnaResponse.encoded) {
          alert('DNA encoding failed.');
          setIsUploading(false);
          return;
        }

        setEncodedDNA(dnaResponse.encoded);
        setShowEncodedDNA(true);
      }

      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Upload error:', err.message);
      alert('Upload failed. Check console for details.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="dna-form-container mt-8">
      <CardHeader
        title="DATA STORAGE"
        subheader="Upload your file directly or encode it into synthetic DNA"
      />
      <CardContent>
        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <InputLabel htmlFor="file">File to Upload</InputLabel>
            <Input id="file" type="file" onChange={handleFileChange} fullWidth />
            {isUploading && <LinearProgress sx={{ my: 2 }} />}

            <InputLabel>Upload Method</InputLabel>
            <RadioGroup
              value={uploadMethod}
              onChange={(e) => setUploadMethod(e.target.value as 'direct' | 'dna')}
              row
            >
              <FormControlLabel value="direct" control={<Radio />} label="Direct Upload" />
              <FormControlLabel value="dna" control={<Radio />} label="DNA Encoding" />
            </RadioGroup>

            {uploadMethod === 'dna' && (
              <Box>
                <Typography variant="h6">DNA Encoding Parameters</Typography>
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
                      {showEncodedDNA ? 'Encoded DNA' : 'View Encoded DNA'}
                    </Button>
                    {showEncodedDNA && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="h6">DNA STRANDS</Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{encodedDNA}</Typography>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            )}

            <Box mt={2} display="flex" justifyContent="space-between">
              <Button variant="outlined" onClick={resetForm}>
                Reset
              </Button>
              <Button variant="contained" type="submit" disabled={!SelectedFile || isUploading}>
                {isUploading ? 'Uploading...' : 'Upload File'}
              </Button>
            </Box>
          </form>
        ) : (
          <Box className="space-y-4">
          <Typography variant="h6">Upload Complete</Typography>
          {digestIpfs && (
            <Typography variant="body2" sx={{ mt: 2 }}>
              Digest: {digestIpfs}
            </Typography>
          )}

            <Box mt={2} display="flex" gap={2}>
              <Button onClick={resetForm} variant="outlined" fullWidth>
                Upload Another File
              </Button>
              <Button variant="contained" fullWidth>
                View Details
              </Button>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default App ;
