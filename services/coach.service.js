const { default: axios } = require('axios');
const { InlineKeyboard, InputFile } = require('grammy');
const sharp = require('sharp');

class CoachService {
  constructor(coachModel) {
    this.coachModel = coachModel;
    this.coachState = {};
  }

  async handleCoachActions(userId, ctx) {
    if (this.coachState[userId]) {
      if (
        this.coachState[userId].step === 1 &&
        !this.coachState[userId].prevCoachName
      ) {
        const userName = ctx.message.text.trim();

        if (
          userName.length < 2 ||
          (userName.length > 50 && this.coachState[userId].step === 1)
        ) {
          await ctx.reply(
            'Імʼя повинно містити від 2 до 50 символів. Спробуйте ще раз:'
          );
          return;
        }
        this.coachState[userId].step = 2;
        this.coachState[userId].name = userName;
        await ctx.reply(`Тепер введіть основні направлення:`);
      } else if (
        this.coachState[userId].step === 2 &&
        !this.coachState[userId].prevCoachName
      ) {
        const jobTitle = ctx.message.text;
        this.coachState[userId].jobTitle = jobTitle.trim();
        this.coachState[userId].step = 3;
        await ctx.reply(`Тепер введіть досвід роботи (в роках):`);
      } else if (
        this.coachState[userId].step === 3 &&
        !this.coachState[userId].prevCoachName
      ) {
        const experience = ctx.message.text;
        this.coachState[userId].experience = experience.trim();
        this.coachState[userId].step = 4;
        await ctx.reply(`Тепер додайте посилання на фото тренера:`);
      } else if (
        this.coachState[userId].step === 4 &&
        !this.coachState[userId].prevCoachName
      ) {
        const link = ctx.message.text;
        this.coachState[userId].img = link.trim();

        let { step, ...restCoachData } = this.coachState[userId];

        const result = await addCoaches(restCoachData);

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

      if (
        this.coachState[userId] &&
        this.coachState[userId].step === 1 &&
        this.coachState[userId].prevCoachName
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
        this.coachState[userId].name = userName;

        this.coachState[userId].step = 2;
        await ctx.reply(`Тепер введіть основні направлення :`);
      } else if (
        this.coachState[userId].step === 2 &&
        this.coachState[userId].prevCoachName
      ) {
        const jobTitle = ctx.message.text;
        this.coachState[userId].jobTitle = jobTitle;
        this.coachState[userId].step = 3;
        await ctx.reply(`Тепер введіть досвід роботи (в роках):`);
      } else if (
        this.coachState[userId].step === 3 &&
        this.coachState[userId].prevCoachName
      ) {
        const experience = ctx.message.text;
        this.coachState[userId].experience = experience;
        this.coachState[userId].step = 4;
        await ctx.reply(`Тепер додайте посилання на фото тренера:`);
      } else if (
        this.coachState[userId].step === 4 &&
        this.coachState[userId].prevCoachName
      ) {
        const link = ctx.message.text;
        this.coachState[userId].img = link;

        let { step, prevCoachName, ...restCoachData } = this.coachState[userId];

        const result = await editCoach(restCoachData, prevCoachName);

        if (result) {
          await ctx.reply('Тренера відредаговано!');
          delete this.coachState[userId];
          return;
        } else {
          await ctx.reply('Тренера не вдалось відредагувати!');
          return;
        }
      }
      if (!this.coachState[userId]) {
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
        }
      }
    }
  }

  async getCoaches() {
    return this.coachModel.find({});
  }
}

module.exports = { CoachService };
