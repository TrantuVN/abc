const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const Hive_API_Key = 'p7hropDxhpuLE4smN7K7hw==';

async function moderate(filePath) {
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

module.exports = moderate;