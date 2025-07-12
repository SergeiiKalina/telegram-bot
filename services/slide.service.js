const { default: axios } = require('axios');
const { InlineKeyboard, InputFile } = require('grammy');
const sharp = require('sharp');
const { globalCache } = require('./cache.service')

class SlideService {
  slideState = {};
  constructor(slideModel, validationService, coachService) {
    this.slideModel = slideModel;
    this.validationService = validationService;
    this.coachService = null;
  }

  setCoachService(coachService) {
    this.coachService = coachService;
  }

  async getSlides() {
    if (!globalCache.has('slides')) {
      const slides = await this.slideModel.find({});
      globalCache.set('slides', slides)

      return slides
    } else {
      return globalCache.get('slides')
    }
  }

  async editSlide(slide, id) {
    const updatedSlide = await this.slideModel.findOne({
      _id: id,
    });

    if (!updatedSlide) {
      return false;
    }

    updatedSlide.img = slide.img;
    updatedSlide.alt = slide.alt;

    await updatedSlide.save();

    return true;
  }

  async addSlide(link, alt) {
    try {
      let newSlide = {
        img: link,
        alt,
      };


      const slide = new this.slideModel(newSlide);
      await slide.save();

      return true;
    } catch (error) {
      console.error('Ошибка при добавлении слайда:', error);
      return false;
    }
  }

  async removeSlide(id) {
    await this.slideModel.deleteOne({ _id: id });
    globalCache.delete('slides')
  }

  async sendAllSlideToTelegram(ctx) {
    await ctx.reply('⏳ Завантажую слайди...')

    const slides = await this.getSlides();

    if (!slides || slides.length === 0) {
      await ctx.reply('На жаль, немає слайдів у базі даних.');
      return;
    }
    try {
      for (const slide of slides) {
        if (!slide.img || slide.img.startsWith('http')) {
          console.error(
            `Не правильне формат зображення для слайду ${slide.name}`
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
          const imageBuffer = Buffer.from(slide.img, 'base64');

          const compressedImage = await sharp(imageBuffer)
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

  async processSlideActionFirstStep(ctx, userId) {
    const message = ctx.message;

    const fileId = message?.photo
      ? message.photo[message.photo.length - 1].file_id
      : message?.document?.file_id;

    if (!fileId) {
      await ctx.reply('Будь ласка, надішліть зображення (фото або документ).');
      return;
    }

    try {
      const file = await ctx.api.getFile(fileId);

      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_API_KEY}/${file.file_path}`;

      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

      let imageBuffer = Buffer.from(response.data, 'binary');
      let base64 = imageBuffer.toString('base64');

      if (base64.length > 16_000_000) {

        imageBuffer = await sharp(imageBuffer)
          .resize({ width: 3042 })
          .jpeg({ quality: 100 })
          .toBuffer();

        base64 = imageBuffer.toString('base64');

        if (base64.length > 16_000_000) {
          await ctx.reply('Фото занадто велике навіть після стиснення. Спробуйте інше або зменшіть розмір.');
          return;
        }
      }

      this.slideState[userId].img = base64
      this.slideState[userId].step = 2

      await ctx.reply('Фото отримано. Тепер введіть опис (до 20 символів).');
    } catch (error) {
      console.error('Помилка при отриманні фото:', error);
      await ctx.reply('Не вдалося отримати фото. Спробуйте ще раз.');
    }
  }

  async processSlideEditActionSecondStep(ctx, userId) {
    const alt = ctx.message.text.trim();

    if (!this.validationService.isValidAltText(alt)) {
      await ctx.reply(
        `Невиконані умови, опис не може бути більше 20 символів і не пустий`
      );
      return;
    }

    this.slideState[userId].alt = alt;

    const result = await this.editSlide(
      this.slideState[userId],
      this.slideState[userId].slideId
    );

    if (result) {
      await ctx.reply('Слайд відредаговано!');
      delete this.slideState[userId];
      globalCache.delete('slides')
      return;
    } else {
      await ctx.reply('Слайд не вдалось відредагувати!');
      delete this.slideState[userId];
      globalCache.delete('slides')
      return;
    }
  }

  async processSlideAddActionSecondStep(ctx, userId) {
    const alt = ctx.message.text.trim();

    if (!this.validationService.isValidAltText(alt)) {
      await ctx.reply(
        `Невиконані умови, опис не може бути більше 20 символів і не пустий`
      );
      return;
    }
    this.slideState[userId].alt = alt;

    const result = await this.addSlide(
      this.slideState[userId].img,
      this.slideState[userId].alt
    );

    if (result) {
      await ctx.reply('Слайд додано!');
      delete this.slideState[userId];
      globalCache.delete('slides')
      return;
    } else {
      await ctx.reply('Слайд не вдалось додати!');
      delete this.slideState[userId];
      globalCache.delete('slides')
      return;
    }
  }

  async processSlideStep(ctx, userId) {

    if (this.slideState[userId].step === 1) {
      await this.processSlideActionFirstStep(ctx, userId);
    } else if (this.slideState[userId].step === 2) {
      if (this.slideState[userId].slideId) {
        await this.processSlideEditActionSecondStep(ctx, userId);
      } else {
        await this.processSlideAddActionSecondStep(ctx, userId);
      }
    }
  }

  async handleSlideActions(userId, ctx) {
    if (!this.slideState[userId] && ctx.message.text === 'Додати слайд') {
      await ctx.reply('Привіт! Щоб заповнити додати слайд натисніть кнопку.', {
        reply_markup: new InlineKeyboard().text(
          'Заповнити форму',
          'fill_slide_form'
        ),
      });
    }
    if (this.slideState[userId]) {
      await this.processSlideStep(ctx, userId);
    }
  }

  async slideCallbackQueryActions(ctx) {
    const callbackData = ctx.callbackQuery.data;
    const [action, identifier] = callbackData.split('::');

    if (callbackData === 'fill_slide_form') {
      this.slideState[ctx.from.id] = { step: 1 };

      await ctx.reply('Додайте слайд:');
    } else if (action === 'edit_slide') {
      this.userState = {};
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
      this.slideState[ctx.from.id] = { step: 1, slideId: identifier };
      await ctx.reply(
        `Скиньте картинку нового слайду: Старий id:(${identifier}):`
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
      await this.removeSlide(identifier);
      globalCache.delete('slides')
      await ctx.reply('Слайд видалено.');
    } else if (action === 'cancel_remove_slide') {
      await ctx.reply('Відмінено.');
      globalCache.delete('slides')
    }
  }

  async dropSlideState() {
    this.slideState = {};
  }
}

module.exports = { SlideService };
