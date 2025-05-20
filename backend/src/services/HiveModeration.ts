import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

const Hive_API_Key = ''; // Replace with your API key

export async function moderate(filePath: string): Promise<{ class: string; score: number }> {
  const form = new FormData();
  form.append('media', fs.createReadStream(filePath));

  const headers = {
    ...form.getHeaders(),
    Authorization: `Token ${Hive_API_Key}`,
  };

  const res = await axios.post('https://api.thehive.ai/api/v2/task/sync', form, { headers });
  const result = res.data.status.response.output[0].classes[0];

  return { class: result.class, score: result.score };
}

export default moderate;
