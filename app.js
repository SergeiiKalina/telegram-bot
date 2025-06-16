require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.EXPRESS_PORT || 8080;

app.get('/api/coaches', async (req, res) => {
  try {
    const coaches = await Coach.find();

    res.json(coaches);
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні тренерів' });
  }
});

app.get('/api/slides', async (req, res) => {
  try {
    const slides = await Slide.find();

    res.json(slides);
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні слайдів' });
  }
});

function startApi() {
  app.use(cors());
  app.use(express.json());

  app.listen(port, () => {
    console.log(`🚀 Express API працює на порту ${port}`);
  });
}

module.exports = { startApi };
