const { default: axios } = require('axios');
const { InlineKeyboard, InputFile } = require('grammy');
const sharp = require('sharp');

class CoachService {
  coachState = {};
  constructor(coachModel, validationService, slideService) {
    this.coachModel = coachModel;
    this.validationService = validationService;
    this.slideService = slideService;
  }

  async processCoachActionFirstStep(ctx, userId) {
    const userName = ctx.message.text;

    if (this.validationService.isValidCoachName(userName)) {
      await ctx.reply(
        'Імʼя повинно містити від 2 до 50 символів. Спробуйте ще раз:'
      );
      return;
    }
    this.coachState[userId].step = 2;
    this.coachState[userId].name = userName.trim();
    await ctx.reply(`Тепер введіть основні направлення:`);
  }

  async processCoachActionSecondStep(ctx, userId) {
    const jobTitle = ctx.message.text;
    this.coachState[userId].jobTitle = jobTitle.trim();
    this.coachState[userId].step = 3;
    await ctx.reply(`Тепер введіть досвід роботи (в роках):`);
  }

  async processCoachActionThirdStep(ctx, userId) {
    const experience = ctx.message.text;
    this.coachState[userId].experience = experience.trim();
    this.coachState[userId].step = 4;
    await ctx.reply(`Тепер додайте посилання на фото тренера:`);
  }

  async processAddCoachActionFourthStep(ctx, userId) {
    const link = ctx.message.text;

    if (!this.validationService.isValidLink(link)) {
      await ctx.reply('Посилання не коретне, додай коректне посилання!');
      return;
    }

    this.coachState[userId].img = link.trim();

    let { step, ...restCoachData } = this.coachState[userId];

    const result = await this.addCoaches(restCoachData);

    if (result) {
      await ctx.reply('Тренера додано!');
      delete this.coachState[userId];
      return;
    } else {
      await ctx.reply('Щось пішло не так!');
      delete this.coachState[userId];
      return;
    }
  }

  async processEditCoachActionFourthStep(ctx, userId) {
    const link = ctx.message.text;

    if (!this.validationService.isValidLink(link)) {
      await ctx.reply('Посилання не коретне, додай коректне посилання!');
      return;
    }

    this.coachState[userId].img = link;

    let { step, prevCoachName, ...restCoachData } = this.coachState[userId];

    const result = await this.editCoach(restCoachData, prevCoachName);

    if (result) {
      await ctx.reply('Тренера відредаговано!');
      delete this.coachState[userId];
      return;
    } else {
      await ctx.reply('Тренера не вдалось відредагувати!');
      return;
    }
  }

  async processCoachStep(ctx, userId) {
    if (this.coachState[userId].step === 1) {
      await this.processCoachActionFirstStep(ctx, userId);
    } else if (this.coachState[userId].step === 2) {
      await this.processCoachActionSecondStep(ctx, userId);
    } else if (this.coachState[userId].step === 3) {
      await this.processCoachActionThirdStep(ctx, userId);
    } else if (this.coachState[userId].step === 4) {
      if (this.coachState[userId].prevCoachName) {
        await this.processEditCoachActionFourthStep(ctx, userId);
      } else {
        await this.processAddCoachActionFourthStep(ctx, userId);
      }
    }
  }

  async handleCoachActions(userId, ctx) {
    if (!this.coachState[userId] && ctx.message.text === 'Додати тренера') {
      await ctx.reply(
        'Привіт! Щоб заповнити форму тренера, натисніть кнопку.',
        {
          reply_markup: new InlineKeyboard().text(
            'Заповнити форму',
            'fill_form'
          ),
        }
      );
    }

    if (this.coachState[userId]) {
      this.processCoachStep(ctx, userId);
    }
  }

  async addCoaches(coach) {
    try {
      let newCoachObject = {
        name: coach.name.toUpperCase(),
        jobTitle: coach.jobTitle,
        experience: coach.experience + ' Років',
        img: coach.img,
        linkOnForm: 'Запис до ' + coach.name,
      };

      const newCoach = new this.coachModel(newCoachObject);
      await newCoach.save();

      return true;
    } catch (error) {
      console.error('Ошибка при добавлении тренеров:', error);
      return false;
    }
  }

  async editCoach(coach, prevName) {
    const updatedCoach = await this.coachModel.findOne({
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

  async coachCallbackQueryActions(ctx) {
    const callbackData = ctx.callbackQuery.data;
    const [action, identifier] = callbackData.split('::');

    if (action === 'remove_coach') {
      await this.handleRemoveCoachPrompt(ctx, identifier);
    } else if (action === 'edit_coach') {
      await this.handleEditCoachPrompt(ctx, identifier);
    } else if (action === 'confirm_edit') {
      await this.handleConfirmEditCoach(ctx, identifier);
    } else if (action === 'cancel_edit') {
      await ctx.reply('Відміна редагування');
    } else if (action === 'confirm_remove') {
      await this.handleConfirmRemoveCoach(ctx, identifier);
    } else if (action === 'cancel_remove') {
      await ctx.reply('Видалення тренера скасовано.');
    } else if (callbackData === 'fill_form') {
      this.handleFillCoachForm(ctx);
    }
  }

  async handleFillCoachForm(ctx) {
    this.coachState[ctx.from.id] = { step: 1 };
    await ctx.reply("Введіть ім'я:");
  }

  async handleRemoveCoachPrompt(ctx, id) {
    const inlineKeyboard = new InlineKeyboard()
      .text('Так', `confirm_remove::${id}`)
      .text('Ні', `cancel_remove::${id}`);

    await ctx.reply(`Ви впевнені, що хочете звільнити тренера ${id}?`, {
      reply_markup: inlineKeyboard,
    });
  }

  async handleConfirmRemoveCoach(ctx, id) {
    await this.coachModel.deleteOne({ name: id });
    await ctx.reply('Тренера видалено.');
  }

  async handleEditCoachPrompt(ctx, id) {
    const inlineKeyboard = new InlineKeyboard()
      .text('Так', `confirm_edit::${id}`)
      .text('Ні', `cancel_edit::${id}`);

    await ctx.reply(`Ви хочете редагувати тренера ${id}?`, {
      reply_markup: inlineKeyboard,
    });
  }

  async handleConfirmEditCoach(ctx, id) {
    this.slideService.dropSlideState();
    this.coachState[ctx.from.id] = {
      step: 1,
      prevCoachName: id,
    };

    await ctx.reply(`Введіть ім'я (поточне значення: ${id}):`);
  }

  async sendAllCoachesToTelegram(ctx) {
    try {
      const coaches = await this.getCoaches();

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

  async dropCoachState() {
    this.coachState = {};
  }

  async getCoaches() {
    return this.coachModel.find({});
  }
}

module.exports = { CoachService };
