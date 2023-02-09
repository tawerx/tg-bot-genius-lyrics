import axios from 'axios';
import cheerio from 'cheerio';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const songs = new Map([]);

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

bot.setMyCommands([
  { command: '/start', description: 'Начальное приветствие' },
  { command: '/info', description: 'Описание бота' },
]);

const getSong = async (song) => {
  try {
    const { data } = await axios.get(`https://api.genius.com/search?q=${song}`, {
      headers: {
        Authorization: `Bearer ${process.env.GENIUS_TOKEN}`,
      },
    });
    if (data) {
      const geniusSong = data.response.hits[0].result;
      const completeSong = {
        status: 200,
        id: geniusSong.id,
        title: geniusSong.full_title,
        img: geniusSong.header_image_thumbnail_url,
        date: geniusSong.release_date_for_display,
        lyric: geniusSong.url,
      };
      songs.delete(songs.keys().next().value);
      songs.set(completeSong.id, completeSong);
      return completeSong;
    }
  } catch (error) {
    return {
      status: 404,
      message: `К сожалению, я не нашёл данную композицию на просторах genius :(. Возможно где-то имеется ошибка, перепроверьте название. Чтобы добиться точного поиска, введите название трека и исполнители в точности, как они записаны на музыкальных площадках`,
    };
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
          keyboard: [[{ text: `Информация` }]],
          resize_keyboard: true,
        },
      },
    );
  } else if (text == 'Информация' || text == '/info') {
    await bot.sendMessage(
      chatId,
      'Пришли мне называние трека. Чтобы поиск был точнее введи название трека и исполнителя',
    );
  } else if (text) {
    const assumeSong = await getSong(text);

    if (assumeSong.status == 200) {
      await bot.sendPhoto(chatId, assumeSong.img);
      await bot.sendMessage(
        chatId,
        `Вы имели ввиду это? \n\n${assumeSong.title}\n${assumeSong.date}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Да, это оно',
                  callback_data: `${assumeSong.id}`,
                },
              ],
              [{ text: 'Нет, это не оно', callback_data: `again ${assumeSong.id}` }],
            ],
          },
        },
      );
    } else {
      await bot.sendMessage(chatId, assumeSong.message);
    }
  }
});

bot.on('callback_query', async (msg) => {
  const chatId = msg.message.chat.id;
  const data = msg.data;

  if (!data.includes('again')) {
    if (songs.has(Number(data))) {
      await bot.sendMessage(chatId, 'Печатаю текст');
      const lyricUrl = songs.get(Number(data)).lyric;
      const lyrics = await getData(lyricUrl);
      if (lyrics.length > 3000) {
        await bot.sendMessage(chatId, lyrics.substring(0, lyrics.length / 3));
        await bot.sendMessage(chatId, lyrics.substring(lyrics.length / 3, lyrics.length * (2 / 3)));
        await bot.sendMessage(chatId, lyrics.substring(lyrics.length * (2 / 3), lyrics.length));
      } else {
        await bot.sendMessage(chatId, lyrics);
        await bot.sendMessage(chatId, lyricUrl);
      }
      if (songs.has(Number(data))) {
        songs.delete(Number(data));
      }
    } else {
      await bot.sendMessage(chatId, 'Попробуйте еще раз');
    }
  } else {
    const id = data.split(' ')[1];
    if (songs.has(Number(id))) {
      songs.delete(Number(id));
    }
    await bot.sendMessage(chatId, 'Попробуйте еще раз');
  }
});
