require('dotenv').config();
const { SlideService } = require('../services/slide.service');
const { Bot, InlineKeyboard, Keyboard, InputFile } = require('grammy');
const Slide = require('../models/slide.model');
const Coach = require('../models/coach.model');
const { default: axios } = require('axios');
const sharp = require('sharp');
const { CoachService } = require('../services/coach.service');

const slideService = new SlideService(Slide);
const coachService = new CoachService(Coach);

let userState = {};

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
      slideService.slideState = {};

      const slides = await slideService.getSlides();
      await slideService.sendAllSlideToTelegram(ctx, slides);
    }
    if (ctx.message.text === 'Тренери') {
      try {
        const coaches = await coachService.getCoaches();
        if (!coaches || coaches.length === 0) {
          await ctx.reply('На жаль, немає тренерів у базі даних.');
          return;
        }

        for (const coach of coaches) {
          if (!coach.img || !coach.img.startsWith('http')) {
            console.error(
              `Не правильне посилання на зображення для тренера ${coach.name}`
            );
            continue;
          }
          const inlineKeyboard = new InlineKeyboard()
            .text('Звільнити', `remove_coach::${coach.name}`)
            .text('Редагувати', `edit_coach::${coach.name}`);

          const trainerMessage = `
            <b>${coach.name}</b>
            <i>${coach.jobTitle}</i>
            <b>Досвід:</b> ${coach.experience}
          `;

          try {
            const response = await axios.get(coach.img, {
              responseType: 'arraybuffer',
            });

            const compressedImage = await sharp(response.data)
              .resize(1024)
              .png()
              .toBuffer();

            await ctx.replyWithPhoto(new InputFile(compressedImage), {
              caption: trainerMessage,
              parse_mode: 'HTML',
              reply_markup: inlineKeyboard,
            });
          } catch (err) {
            console.error(
              `Помилка при відправці фото для тренера ${coach.name}:`,
              err
            );
            await ctx.reply('Виникла помилка при відправці фото тренера.');
          }
        }
      } catch (error) {
        console.error('Помилка при отриманны тренера:', error);
        await ctx.reply('Не вдалося отримати інформацію про тренерів.');
      }
    }
  });

  bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    const [action, identifier] = callbackData.split('::');

    await slideService.slideCallbackQueryActions(ctx);

    if (action === 'remove_coach') {
      const inlineKeyboard = new InlineKeyboard()
        .text('Так', `confirm_remove::${identifier}`)
        .text('Ні', `cancel_remove::${identifier}`);

      await ctx.reply(
        `Ви впевнені, що хочете звільнити тренера ${identifier}?`,
        {
          reply_markup: inlineKeyboard,
        }
      );
    } else if (action === 'edit_coach') {
      const inlineKeyboard = new InlineKeyboard()
        .text('Так', `confirm_edit::${identifier}`)
        .text('Ні', `cancel_edit::${identifier}`);

      await ctx.reply(`Ви хочете редагувати тренера ${identifier}?`, {
        reply_markup: inlineKeyboard,
      });
    } else if (action === 'confirm_edit') {
      this.slideState = {};
      userState[ctx.from.id] = {
        step: 1,
        prevCoachName: identifier,
      };
      await ctx.reply(`Введіть ім'я (поточне значення: ${identifier}):`);
    } else if (action === 'cancel_edit') {
      await ctx.reply('Відміна редагування');
    } else if (action === 'confirm_remove') {
      await Coach.deleteOne({ name: identifier });
      await ctx.reply('Тренера видалено.');
    } else if (action === 'cancel_remove') {
      await ctx.reply('Видалення тренера скасовано.');
    } else if (callbackData === 'fill_form') {
      this.userState[ctx.from.id] = { step: 1 };

      await ctx.reply("Введіть ім'я:");
    }
  });

  bot.start();
}

module.exports = { startBot };
