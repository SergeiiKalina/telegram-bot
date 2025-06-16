require('dotenv').config();
const { Bot, InlineKeyboard, Keyboard, InputFile } = require('grammy');
const mongoose = require('mongoose');
const { Schema } = mongoose;
const express = require('express');
const cors = require('cors');
const { default: axios } = require('axios');
const sharp = require('sharp');
const { SlideService } = require('./services/slide.service');

const app = express();
const port = process.env.EXPRESS_PORT || 8080;

const linkRegex = /^(https?:\/\/)[^\s$.?#].[^\s]*$/i;
let userState = {};
let slideState = {};

mongoose
  .connect(process.env.MONGODB_LINK)
  .then(() => console.log('Подключение к MongoDB успешно!'))
  .catch((err) => console.log('Ошибка подключения к MongoDB: ', err));

const coachSchema = new Schema({
  name: { type: String },
  jobTitle: { type: String },
  img: { type: String },
  linkOnForm: { type: String },
  experience: { type: String },
});

const sliderSchema = new Schema({
  img: { type: String },
  alt: { type: String },
});

const Coach = mongoose.model('Coach', coachSchema);
const Slide = mongoose.model('Slide', sliderSchema);

const slideService = new SlideService(Slide);

const bot = new Bot(process.env.BOT_API_KEY);

bot.command('start', async (ctx) => {
  userState = {};
  slideState = {};
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

  if (slideState[userId]) {
    if (slideState[userId].step === 1 && slideState[userId].slideId) {
      const link = ctx.message.text.trim();
      if (!linkRegex.test(link)) {
        await ctx.reply(`Посилання не вірного формату`);
        return;
      }
      slideState[userId].img = link;
      slideState[userId].step = 2;
      await ctx.reply(
        `Тепер короткий опис для картинки(не більше 20 символів):`
      );
    } else if (slideState[userId].step === 2 && slideState[userId].slideId) {
      const alt = ctx.message.text.trim();
      if (alt.length === 0 || alt.length > 20) {
        await ctx.reply(
          `Невиконані умови, опис не може бути більше 20 символів і не пустий`
        );
        return;
      }
      slideState[userId].alt = alt;

      const result = await slideService.editSlide(
        slideState[userId],
        slideState[userId].slideId
      );

      if (result) {
        await ctx.reply('Слайд відредаговано!');
        delete slideState[userId];
        return;
      } else {
        await ctx.reply('Слайд не вдалось відредагувати!');
        delete slideState[userId];
        return;
      }
    }

    if (slideState[userId].step === 1 && !slideState[userId].slideId) {
      const link = ctx.message.text.trim();
      if (!linkRegex.test(link)) {
        await ctx.reply(`Посилання не вірного формату`);
        return;
      }
      slideState[userId].img = link;
      slideState[userId].step = 2;
      await ctx.reply(
        `Тепер короткий опис для картинки(не більше 20 символів):`
      );
    } else if (slideState[userId].step === 2 && !slideState[userId].slideId) {
      const alt = ctx.message.text.trim();
      if (alt.length === 0 || alt.length > 20) {
        await ctx.reply(
          `Невиконані умови, опис не може бути більше 20 символів і не пустий`
        );
        return;
      }
      slideState[userId].alt = alt;

      const result = await slideService.addSlide(
        slideState[userId].img,
        slideState[userId].alt
      );

      if (result) {
        await ctx.reply('Слайд додано!');
        delete slideState[userId];
        return;
      } else {
        await ctx.reply('Слайд не вдалось додати!');
        delete slideState[userId];
        return;
      }
    }
  }
  if (userState[userId]) {
    if (userState[userId].step === 1 && !userState[userId].prevCoachName) {
      const userName = ctx.message.text.trim();

      if (
        userName.length < 2 ||
        (userName.length > 50 && userState[userId].step === 1)
      ) {
        await ctx.reply(
          'Імʼя повинно містити від 2 до 50 символів. Спробуйте ще раз:'
        );
        return;
      }
      userState[userId].step = 2;
      userState[userId].name = userName;
      await ctx.reply(`Тепер введіть основні направлення:`);
    } else if (
      userState[userId].step === 2 &&
      !userState[userId].prevCoachName
    ) {
      const jobTitle = ctx.message.text;
      userState[userId].jobTitle = jobTitle.trim();
      userState[userId].step = 3;
      await ctx.reply(`Тепер введіть досвід роботи (в роках):`);
    } else if (
      userState[userId].step === 3 &&
      !userState[userId].prevCoachName
    ) {
      const experience = ctx.message.text;
      userState[userId].experience = experience.trim();
      userState[userId].step = 4;
      await ctx.reply(`Тепер додайте посилання на фото тренера:`);
    } else if (
      userState[userId].step === 4 &&
      !userState[userId].prevCoachName
    ) {
      const link = ctx.message.text;
      userState[userId].img = link.trim();

      let { step, ...restCoachData } = userState[userId];

      const result = await addCoaches(restCoachData);

      if (result) {
        await ctx.reply('Тренера додано!');
        delete userState[userId];
        return;
      } else {
        await ctx.reply('Щось пішло не так!');
        delete userState[userId];
        return;
      }
    }

    if (
      userState[userId] &&
      userState[userId].step === 1 &&
      userState[userId].prevCoachName
    ) {
      const userName = ctx.message.text;

      if (
        userName.length < 2 ||
        (userName.length > 50 && userState[userId].step === 1)
      ) {
        await ctx.reply(
          'Імʼя повинно містити від 2 до 50 символів. Спробуйте ще раз:'
        );
        return;
      }
      userState[userId].name = userName;

      userState[userId].step = 2;
      await ctx.reply(`Тепер введіть основні направлення :`);
    } else if (
      userState[userId].step === 2 &&
      userState[userId].prevCoachName
    ) {
      const jobTitle = ctx.message.text;
      userState[userId].jobTitle = jobTitle;
      userState[userId].step = 3;
      await ctx.reply(`Тепер введіть досвід роботи (в роках):`);
    } else if (
      userState[userId].step === 3 &&
      userState[userId].prevCoachName
    ) {
      const experience = ctx.message.text;
      userState[userId].experience = experience;
      userState[userId].step = 4;
      await ctx.reply(`Тепер додайте посилання на фото тренера:`);
    } else if (
      userState[userId].step === 4 &&
      userState[userId].prevCoachName
    ) {
      const link = ctx.message.text;
      userState[userId].img = link;

      let { step, prevCoachName, ...restCoachData } = userState[userId];

      const result = await editCoach(restCoachData, prevCoachName);

      if (result) {
        await ctx.reply('Тренера відредаговано!');
        delete userState[userId];
        return;
      } else {
        await ctx.reply('Тренера не вдалось відредагувати!');
        return;
      }
    }
  }
  if (!userState[userId]) {
    if (ctx.message.text === 'Додати тренера') {
      await ctx.reply(
        'Привіт! Щоб заповнити форму тренера, натисніть кнопку.',
        {
          reply_markup: new InlineKeyboard().text(
            'Заповнити форму',
            'fill_form'
          ),
        }
      );
    } else if (ctx.message.text === 'Додати слайд') {
      await ctx.reply('Привіт! Щоб заповнити додати слайд натисніть кнопку.', {
        reply_markup: new InlineKeyboard().text(
          'Заповнити форму',
          'fill_slide_form'
        ),
      });
    }
    if (ctx.message.text === 'Тренери') {
      userState = {};
      slideState = {};
      try {
        const coaches = await Coach.find();
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
    if (ctx.message.text === 'Слайды') {
      userState = {};
      slideState = {};
      try {
        const slides = await slideService.getSlides();
        if (!slides || slides.length === 0) {
          await ctx.reply('На жаль, немає слайдів у базі даних.');
          return;
        }

        for (const slide of slides) {
          if (!slide.img || !slide.img.startsWith('http')) {
            console.error(
              `Не правильне посилання на зображення для слайду ${slide.name}`
            );
            continue;
          }
          const inlineKeyboard = new InlineKeyboard()
            .text('Видалити', `remove_slide::${slide._id}`)
            .text('Редагувати', `edit_slide::${slide._id}`);

          const trainerMessage = `
        <i>${slide._id}</i>
         <b>${slide?.alt || ''}</b>
      `;

          try {
            const response = await axios.get(slide.img, {
              responseType: 'arraybuffer',
            });

            const compressedImage = await sharp(response.data)
              .resize(1024)
              .toBuffer();

            await ctx.replyWithPhoto(new InputFile(compressedImage), {
              caption: trainerMessage,
              parse_mode: 'HTML',
              reply_markup: inlineKeyboard,
            });
          } catch (err) {
            console.error(
              `Помилка при відправці фото для слайду ${slide.alt}:`,
              err
            );
            await ctx.reply('Виникла помилка при відправці фото слайду.');
          }
        }
      } catch (error) {
        console.error('Помилка при отриманні слайду:', error);
        await ctx.reply('Не вдалося отримати інформацію про слайдів.');
      }
    }
  }
});

bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const [action, identifier] = callbackData.split('::');

  if (action === 'remove_coach') {
    const inlineKeyboard = new InlineKeyboard()
      .text('Так', `confirm_remove::${identifier}`)
      .text('Ні', `cancel_remove::${identifier}`);

    await ctx.reply(`Ви впевнені, що хочете звільнити тренера ${identifier}?`, {
      reply_markup: inlineKeyboard,
    });
  } else if (action === 'edit_coach') {
    const inlineKeyboard = new InlineKeyboard()
      .text('Так', `confirm_edit::${identifier}`)
      .text('Ні', `cancel_edit::${identifier}`);

    await ctx.reply(`Ви хочете редагувати тренера ${identifier}?`, {
      reply_markup: inlineKeyboard,
    });
  } else if (action === 'confirm_edit') {
    slideState = {};
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
    userState[ctx.from.id] = { step: 1 };

    await ctx.reply("Введіть ім'я:");
  } else if (callbackData === 'fill_slide_form') {
    slideState[ctx.from.id] = { step: 1 };

    await ctx.reply('Введіть посилання на слайд:');
  } else if (action === 'edit_slide') {
    userState = {};
    try {
      const inlineKeyboard = new InlineKeyboard()
        .text('Так', `confirm_edit_slide::${identifier}`)
        .text('Ні', `cancel_edit_slide::${identifier}`);

      await ctx.reply(
        `Ви впевнені, що хочете змінити слайд з id: ${identifier}?`,
        {
          reply_markup: inlineKeyboard,
        }
      );
    } catch (error) {
      console.error(error);
    }
  } else if (action === 'confirm_edit_slide') {
    slideState[ctx.from.id] = { step: 1, slideId: identifier };
    await ctx.reply(
      `Введіть посилання на картинку нового слайду: Старий id:(${identifier}):`
    );
  } else if (action === 'remove_slide') {
    const inlineKeyboard = new InlineKeyboard()
      .text('Так', `confirm_remove_slide::${identifier}`)
      .text('Ні', `cancel_remove_slide::${identifier}`);
    await ctx.reply(
      `Ви впевнені, що хочете видалити слайд з id: ${identifier}?`,
      {
        reply_markup: inlineKeyboard,
      }
    );
  } else if (action === 'confirm_remove_slide') {
    await slideService.removeSlide(identifier);
    await ctx.reply('Слайд видалено.');
  } else if (action === 'cancel_remove_slide') {
    await ctx.reply('Відмінено.');
  }
});

bot.start();

async function addCoaches(coach) {
  try {
    let newCoachObject = {
      name: coach.name.toUpperCase(),
      jobTitle: coach.jobTitle,
      experience: coach.experience + ' Років',
      img: coach.img,
      linkOnForm: 'Запис до ' + coach.name,
    };

    const newCoach = new Coach(newCoachObject);
    await newCoach.save();

    return true;
  } catch (error) {
    console.error('Ошибка при добавлении тренеров:', error);
    return false;
  }
}

async function editCoach(coach, prevName) {
  const updatedCoach = await Coach.findOne({
    name: prevName,
  });

  if (!updatedCoach) {
    return false;
  }

  updatedCoach.name = coach.name.toUpperCase();
  updatedCoach.jobTitle = coach.jobTitle;
  updatedCoach.img = coach.img;
  updatedCoach.experience = coach.experience.replace(' Років', '') + ' Років';
  updatedCoach.linkOnForm = 'Запис до ' + coach.name;

  await updatedCoach.save();

  return true;
}

app.use(express.json());
app.use(cors());

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

app.listen(port, () => {
  console.log(`Сервер Express запущен на порту ${port}`);
});
