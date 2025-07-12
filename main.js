require('dotenv').config();
const mongoose = require('mongoose');
const { startBot } = require('./bot/index');
const { startApi } = require('./app');

async function main() {
  try {
    mongoose
      .connect(process.env.MONGODB_LINK)
      .then(() => console.log('Подключение к MongoDB успешно!'))
      .catch((err) => console.log('Ошибка подключения к MongoDB: ', err));

    startApi();
    startBot();
  } catch (err) {
    console.error('❌ Помилка підключення MongoDB:', err);
  }
}

main();
