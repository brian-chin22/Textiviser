require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

app.post('/api/revise', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(prompt);

    const revised = result.response.text();
    res.json({ revised });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to revise text.' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
