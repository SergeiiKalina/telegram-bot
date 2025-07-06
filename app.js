require('dotenv').config();
const express = require('express');
const cors = require('cors');
const coachModel = require('./models/coach.model');
const slideModel = require('./models/slide.model');

const allowedOrigins = ['https://arena-gym.com.ua', 'http://localhost:3000'];

const app = express();
const port = process.env.EXPRESS_PORT || 8080;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, false);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET, POST, PUT, DELETE, PATCH',
  credentials: true,
}));

app.use(express.json());

app.get('/api/coaches', async (req, res) => {
  try {
    const coaches = await coachModel.find();

    res.json(coaches);
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні тренерів' });
  }
});

app.get('/api/slides', async (req, res) => {
  try {
    const slides = await slideModel.find();

    res.json(slides);
  } catch (error) {
    res.status(500).json({ message: 'Помилка при отриманні слайдів' });
  }
});

function startApi() {
  app.listen(port, () => {
    console.log(`🚀 Express API працює на порту ${port}`);
  });
}

module.exports = { startApi };
