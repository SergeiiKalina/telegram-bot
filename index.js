require("dotenv").config();
const { Bot, InlineKeyboard, Keyboard, InputFile } = require("grammy");
const mongoose = require("mongoose");
const { Schema } = mongoose;
const express = require("express");
const cors = require("cors");
const { default: axios } = require("axios");
const sharp = require("sharp");

const app = express();
const port = process.env.EXPRESS_PORT || 8080;

let userState = {};

mongoose
  .connect(process.env.MONGODB_LINK)
  .then(() => console.log("Подключение к MongoDB успешно!"))
  .catch((err) => console.log("Ошибка подключения к MongoDB: ", err));

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

const Coach = mongoose.model("Coach", coachSchema);
const Slide = mongoose.model("Slide", sliderSchema);

const bot = new Bot(process.env.BOT_API_KEY);

bot.command("start", async (ctx) => {
  const keyboard = new Keyboard().text("Тренери").text("Слайды").resized();

  await ctx.reply("Привіт! Виберіть одну з команд:", {
    reply_markup: keyboard,
  });
});

bot.on("message", async (ctx) => {
  if (ctx.message.text === "Тренери") {
    try {
      const coaches = await Coach.find();
      if (!coaches || coaches.length === 0) {
        await ctx.reply("На жаль, немає тренерів у базі даних.");
        return;
      }

      for (const coach of coaches) {
        if (!coach.img || !coach.img.startsWith("http")) {
          console.error(
            `Не правильне посилання на зображення для тренера ${coach.name}`
          );
          continue;
        }
        const inlineKeyboard = new InlineKeyboard()
          .text("Звільнити", `remove_coach::${coach.name}`)
          .text("Редагувати", `edit_coach::${coach.name}`);

        const trainerMessage = `
        <b>${coach.name}</b>
        <i>${coach.jobTitle}</i>
        <b>Досвід:</b> ${coach.experience}
      `;

        try {
          const response = await axios.get(coach.img, {
            responseType: "arraybuffer",
          });

          const compressedImage = await sharp(response.data)
            .resize(1024)
            .toBuffer();

          await ctx.replyWithPhoto(new InputFile(compressedImage), {
            caption: trainerMessage,
            parse_mode: "HTML",
            reply_markup: inlineKeyboard,
          });
        } catch (err) {
          console.error(
            `Помилка при відправці фото для тренера ${coach.name}:`,
            err
          );
          await ctx.reply("Виникла помилка при відправці фото тренера.");
        }
      }
    } catch (error) {
      console.error("Помилка при отриманны тренера:", error);
      await ctx.reply("Не вдалося отримати інформацію про тренерів.");
    }
  }
  if (ctx.message.text === "Слайды") {
    try {
      const slides = await Slide.find();
      if (!slides || slides.length === 0) {
        await ctx.reply("На жаль, немає слайдів у базі даних.");
        return;
      }

      for (const slide of slides) {
        if (!slide.img || !slide.img.startsWith("http")) {
          console.error(
            `Не правильне посилання на зображення для слайду ${slide.name}`
          );
          continue;
        }
        const inlineKeyboard = new InlineKeyboard()
          .text("Звільнити", `remove_slide::${slide.img.split("/").pop()}`)
          .text("Редагувати", `edit_slide::${slide.img.split("/").pop()}`);

        const trainerMessage = `
        <i>${slide.alt}</i>
      `;

        try {
          const response = await axios.get(slide.img, {
            responseType: "arraybuffer",
          });

          const compressedImage = await sharp(response.data)
            .resize(1024)
            .toBuffer();

          await ctx.replyWithPhoto(new InputFile(compressedImage), {
            caption: trainerMessage,
            parse_mode: "HTML",
            reply_markup: inlineKeyboard,
          });
        } catch (err) {
          console.error(
            `Помилка при відправці фото для слайду ${slide.alt}:`,
            err
          );
          await ctx.reply("Виникла помилка при відправці фото слайду.");
        }
      }
    } catch (error) {
      console.error("Помилка при отриманні слайду:", error);
      await ctx.reply("Не вдалося отримати інформацію про слайдів.");
    }
  }
});

bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const [action, identifier] = callbackData.split("::");

  if (action === "remove_coach") {
    const inlineKeyboard = new InlineKeyboard()
      .text("Так", `confirm_remove::${identifier}`)
      .text("Ні", `cancel_remove::${identifier}`);

    await ctx.reply(`Ви впевнені, що хочете звільнити тренера ${identifier}?`, {
      reply_markup: inlineKeyboard,
    });
  } else if (action === "edit_coach") {
    const inlineKeyboard = new InlineKeyboard()
      .text("Так", `confirm_edit::${identifier}`)
      .text("Ні", `cancel_edit::${identifier}`);

    await ctx.reply(`Ви хочете редагувати тренера ${identifier}?`, {
      reply_markup: inlineKeyboard,
    });
  } else if (action === "confirm_edit") {
    userState[ctx.from.id] = {
      step: 1,
      prevCoachName: identifier,
    };
    await ctx.reply(`Введіть ім'я (поточне значення: ${identifier}):`);
  } else if (action === "cancel_edit") {
    await ctx.reply("Відміна редагування");
  } else if (action === "confirm_remove") {
    await Coach.deleteOne({ name: identifier });
    await ctx.reply("Тренера видалено.");
  } else if (action === "cancel_remove") {
    await ctx.reply("Видалення тренера скасовано.");
  } else if (ctx.callbackQuery.data === "fill_form") {
    userState[ctx.from.id] = { step: 1 };

    await ctx.reply("Введіть ім'я:");
  } else if (action === "edit_slide") {
    console.log(identifier);
    const slide = await Slide.find({
      img: { $regex: identifier, $options: "i" },
    });
    console.log(slide);
  }
});

bot.command("add_coach", async (ctx) => {
  await ctx.reply("Привіт! Щоб заповнити форму тренера, натисніть кнопку.", {
    reply_markup: new InlineKeyboard().text("Заповнити форму", "fill_form"),
  });
});

bot.on("message", async (ctx) => {
  const userId = ctx.from.id;

  if (userState[userId]) {
    if (userState[userId].step === 1 && !userState[userId].prevCoachName) {
      const userName = ctx.message.text;
      userState[userId].name = userName;

      userState[userId].step = 2;
      await ctx.reply(`Тепер введіть основні направлення:`);
    } else if (
      userState[userId].step === 2 &&
      !userState[userId].prevCoachName
    ) {
      const jobTitle = ctx.message.text;
      userState[userId].jobTitle = jobTitle;
      userState[userId].step = 3;
      await ctx.reply(`Тепер введіть досвід роботи (в роках):`);
    } else if (
      userState[userId].step === 3 &&
      !userState[userId].prevCoachName
    ) {
      const experience = ctx.message.text;
      userState[userId].experience = experience;
      userState[userId].step = 4;
      await ctx.reply(`Тепер додайте посилання на фото тренера:`);
    } else if (
      userState[userId].step === 4 &&
      !userState[userId].prevCoachName
    ) {
      const link = ctx.message.text;
      userState[userId].img = link;

      let { step, ...restCoachData } = userState[userId];

      const result = await addCoaches(restCoachData);
      if (result) {
        await ctx.reply("Тренера додано!");
        delete userState[userId];
      } else {
        await ctx.reply("Щось пішло не так!");
        delete userState[userId];
      }
    }
    if (
      userState[userId] &&
      userState[userId].step === 1 &&
      userState[userId].prevCoachName
    ) {
      const userName = ctx.message.text;
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
        await ctx.reply("Тренера відредаговано!");
        delete userState[userId];
      } else {
        await ctx.reply("Тренера не вдалось відредагувати!");
      }
    }
  }
});

bot.start();

async function addCoaches(coach) {
  try {
    let newCoachObject = {
      name: coach.name.toUpperCase(),
      jobTitle: coach.jobTitle,
      experience: coach.experience + " Років",
      img: coach.img,
      linkOnForm: "Запис до " + coach.name,
    };

    const newCoach = new Coach(newCoachObject);
    await newCoach.save();

    return true;
  } catch (error) {
    console.error("Ошибка при добавлении тренеров:", error);
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
  updatedCoach.experience = coach.experience.replace(" Років", "") + " Років";
  updatedCoach.linkOnForm = "Запис до " + coach.name;

  await updatedCoach.save();

  return true;
}

async function addSlide(link, alt) {
  try {
    let newSlide = {
      img: link,
      alt,
    };

    const slide = new Slide(newSlide);
    await slide.save();

    return true;
  } catch (error) {
    console.error("Ошибка при добавлении слайда:", error);
    return false;
  }
}

app.use(express.json());
app.use(cors());

app.get("/api/coaches", async (req, res) => {
  try {
    const coaches = await Coach.find();

    res.json(coaches);
  } catch (error) {
    res.status(500).json({ message: "Помилка при отриманні тренерів" });
  }
});

app.get("/api/slides", async (req, res) => {
  try {
    const slides = await Slide.find();

    res.json(slides);
  } catch (error) {
    res.status(500).json({ message: "Помилка при отриманні слайдів" });
  }
});

app.listen(port, () => {
  console.log(`Сервер Express запущен на порту ${port}`);
});
