import axios from 'axios';
import cheerio from 'cheerio';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const getData = async (url) => {
  try {
    const { data } = await axios.get(url);

    const $ = cheerio.load(data);

    $('div.Lyrics__Container-sc-1ynbvzw-6')
      .find('br')
      .each((i, item) => $(item).replaceWith('\n'));
    const lyrics = [];
    $('div.Lyrics__Container-sc-1ynbvzw-6').each((_, taste) => lyrics.push($(taste).text()));
    if (lyrics.length > 0) {
      return lyrics.join();
    } else {
      return `К сожалению я ничего не нашёл, возможно неверно указана ссылка, либо я не могу достать текст данной композиции :(`;
    }
  } catch (error) {
    return `К сожалению я ничего не нашёл, возможно неверно указана ссылка, либо я не могу достать текст данной композиции :(`;
  }
};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text == '/start') {
    await bot.sendMessage(
      chatId,
      'Привет, я могу найти текст песни с платформы genius: https://genius.com/',
      {
        reply_markup: {
          keyboard: [[{ text: `Найти текст` }]],
          resize_keyboard: true,
        },
      },
    );
  } else if (text == 'Найти текст') {
    await bot.sendMessage(chatId, 'Пришли мне ссылку с текстом песни с платформы genius');
  } else if (text) {
    await bot.sendMessage(chatId, 'Процесс запущен');
    const lyrics = await getData(text);
    await bot.sendMessage(chatId, lyrics);
  }
});
