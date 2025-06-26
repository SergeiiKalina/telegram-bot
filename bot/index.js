require('dotenv').config();
const { SlideService } = require('../services/slide.service');
const { Bot, Keyboard } = require('grammy');
const Slide = require('../models/slide.model');
const Coach = require('../models/coach.model');
const { CoachService } = require('../services/coach.service');
const { ValidationService } = require('../services/validation.service');

const validationService = new ValidationService();
const slideService = new SlideService(Slide, validationService);
const coachService = new CoachService(Coach, validationService, slideService);

slideService.setCoachService(coachService);

function startBot() {
  const bot = new Bot(process.env.BOT_API_KEY);

  bot.command('start', async (ctx) => {
    const keyboard = new Keyboard()
      .text('Тренери')
      .text('Слайды')
      .row()
      .text('Додати тренера')
      .text('Додати слайд')
      .resized();

    await ctx.reply('Привіт! Виберіть одну з команд:', {
      reply_markup: keyboard,
    });
  });

  bot.on('message', async (ctx) => {
    const userId = ctx.from.id;

    await slideService.handleSlideActions(userId, ctx);

    await coachService.handleCoachActions(userId, ctx);

    if (ctx.message.text === 'Слайды') {
      coachService.dropCoachState();
      slideService.dropSlideState();
      await slideService.sendAllSlideToTelegram(ctx);
    }
    if (ctx.message.text === 'Тренери') {
      coachService.dropCoachState();
      slideService.dropSlideState();
      await coachService.sendAllCoachesToTelegram(ctx);
    }
  });

  bot.on('callback_query', async (ctx) => {
    await slideService.slideCallbackQueryActions(ctx);
    await coachService.coachCallbackQueryActions(ctx);
  });

  bot.start();
}

module.exports = { startBot };
