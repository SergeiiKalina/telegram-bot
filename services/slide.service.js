const { default: axios } = require('axios');
const { InlineKeyboard, InputFile } = require('grammy');
const sharp = require('sharp');

class SlideService {
  slideState = {};
  constructor(slideModel, validationService, coachService) {
    this.slideModel = slideModel;
    this.validationService = validationService;
    this.coachService = null;
    this.linkRegex = /^(https?:\/\/)[^\s$.?#].[^\s]*$/i;
  }

  setCoachService(coachService) {
    this.coachService = coachService;
  }

  async getSlides() {
    return this.slideModel.find({});
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
  }

  async sendAllSlideToTelegram(ctx) {
    const slides = await this.getSlides();

    if (!slides || slides.length === 0) {
      await ctx.reply('На жаль, немає слайдів у базі даних.');
      return;
    }
    try {
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

  async processSlideActionFirstStep(ctx, userId) {
    const link = ctx.message.text.trim();

    if (!this.validationService.isValidLink(link)) {
      await ctx.reply(`Посилання не вірного формату`);
      return;
    }

    this.slideState[userId].img = link;
    this.slideState[userId].step = 2;
    await ctx.reply(`Тепер короткий опис для картинки(не більше 20 символів):`);
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
      return;
    } else {
      await ctx.reply('Слайд не вдалось відредагувати!');
      delete this.slideState[userId];
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
      return;
    } else {
      await ctx.reply('Слайд не вдалось додати!');
      delete this.slideState[userId];
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

      await ctx.reply('Введіть посилання на слайд:');
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
      await this.removeSlide(identifier);
      await ctx.reply('Слайд видалено.');
    } else if (action === 'cancel_remove_slide') {
      await ctx.reply('Відмінено.');
    }
  }

  async dropSlideState() {
    this.slideState = {};
  }
}

module.exports = { SlideService };
