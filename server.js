process.env['NTBA_FIX_350'] = 1;
require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const config = require('config');

const {
  connectToMongoDB,
  login,
  postHandler,
  findUserById,
  search,
  searchById,
  removePostById,
} = require('./my_modules/mongo');
const {
  textOptions,
  messageList,
  checkIsUnidentified,
  generateCaption,
} = require('./my_modules/messages');

const PORT = process.env.PORT || config.get('PORT');
const token = process.env.TOKEN || '';

const app = express();
const bot = new TelegramBot(token, { polling: true });

const clientInfo = {};

/**
 * Start tg bot
 */
function start() {
  try {
    connectToMongoDB();

    bot.onText(textOptions.start, async (message) => {
      const startMessageText = messageList.start(message.from.first_name);
      const options = {
        reply_markup: {
          keyboard: [
            [{ text: '🔎Поиск' }, { text: '📰Подать объявление' }],
          ],
          resize_keyboard: true,
        },
      };
      return await send(message, startMessageText, options);
    });

    bot.onText(textOptions.help, async (message) => {
      return await send(message, messageList.help);
    });

    bot.onText(textOptions.search, async (message) => {
      checkClientInfo();

      const currentMessage = clientInfo[message.chat.id]?.prevMessage;
      const prevMessage = await searchHandle(message, currentMessage);

      clientInfo[message.chat.id].prevMessage = prevMessage;
      return prevMessage;
    });

    bot.onText(textOptions.searchById, async (message) => {
      return await searchByIdHandle(message);
    });

    bot.onText(textOptions.newPost, async (message) => {
      return await postHandler(bot, message, send, remove);
    });

    bot.onText(textOptions.deletePost, async (message) => {
      const postId = message.text.split(' ')[1];
      return await removePostById(message, postId, send);
    });

    bot.onText(textOptions.myPosts, async (message) => {
      return await send(message, messageList.myPosts);
    });

    bot.onText(textOptions.myProfile, async (message) => {
      return await send(message, messageList.myProfile);
    });

    bot.onText(textOptions.cls, async (message) => {
      return await clearChat(message);
    });

    bot.on('message', async (message) => {
      checkClientInfo();

      login(message.from);

      if (checkIsUnidentified(message.text) && !message.reply_to_message) {
        await send(message, messageList.unidentified);
      }
    });

    bot.on('callback_query', async (query) => {
      if (!clientInfo[query.from.id]) {
        clientInfo[query.from.id] = { page: 0, prevMessage: null };
      }

      const currentMessage = clientInfo[query.from.id].prevMessage;

      switch (query.data) {
        case 'prev_page':
          const currentPage = clientInfo[query.from.id].page;
          clientInfo[query.from.id].page = (currentPage - 1) || 0;
          break;
        case 'next_page':
          clientInfo[query.from.id].page += 1;
          break;

        default:
          break;
      }

      const prevMessage = await searchHandle(query.message, currentMessage);
      clientInfo[query.from.id].prevMessage = prevMessage;
    });
  } catch (e) {
    console.error(e);
  }
}

/**
 * Search post handler
 *
 * @param {*} message
 * @param {*} prevMessage
 * @return {*}
 */
async function searchHandle(message, prevMessage) {
  checkClientInfo(message.chat.id);

  if (clientInfo[message.chat.id].prevMessage) {
    await remove(message, prevMessage);
  }

  const currentPage = clientInfo[message.chat.id].page;

  let postList = await search(currentPage, message, send, remove);

  if (!postList?.length) {
    clientInfo[message.chat.id].page = 0;
    postList = await search(0, message, send, remove);

    if (!postList.length) {
      const messageEnd = messageList.search.end;
      return await send(message, messageEnd);
    }
  }

  const currentPost = postList[0];

  const owner = await findUserById(currentPost.owner);

  const caption = generateCaption(currentPost, !!currentPost.contacts);
  const options = {
    caption,
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Назад', callback_data: 'prev_page' },
          { text: 'Далее', callback_data: 'next_page' },
        ],
      ],
    },
    parse_mode: 'MarkdownV2',
  };

  if (!currentPost.contacts) {
    const contact = [
      { text: 'Связаться', url: `https://telegram.me/${owner.username}` },
    ];
    options.reply_markup.inline_keyboard.unshift(contact);
  }

  const photoLink = postList[0].photo;

  if (!photoLink) {
    return await send(message, caption, options);
  }

  return await bot.sendPhoto(message.chat.id, photoLink, options)
    .catch((e) => console.log(e));
}

/**
 * Search post by id
 *
 * @param {*} message
 * @return {*}
 */
async function searchByIdHandle(message) {
  const id = message.text.split(' ')[1];
  const currentPost = await searchById(message, id, send, remove);
  if (!currentPost) {
    return await send(message, messageList.search.notFound);
  }
  return await send(message, generateCaption(currentPost));
}

/**
 * Send message
 *
 * @param {*} message
 * @param {String} text
 * @param {*} props
 * @return {*}
 */
async function send(message, text, props) {
  return await bot.sendMessage(message.chat.id, text, props);
}

/**
 * Remove message
 *
 * @param {*} message
 * @param {*} currentMessage
 * @return {*}
 */
async function remove(message, currentMessage) {
  const chatId = message.chat.id;
  const messageId = currentMessage.message_id;
  return await bot.deleteMessage(chatId, messageId).catch(() => { });
}

/**
 * Check client info and fill it
 *
 * @param {Number} id
 * @return {undefined}
 */
function checkClientInfo(id) {
  if (clientInfo[id]) return;

  clientInfo[id] = { page: 0, prevMessage: null };
  return;
}

/**
 *
 * @param {*} message
 */
function clearChat(message, i = 0) {
  return bot
    .deleteMessage(message.chat.id, message.message_id - i)
    .then(() => clearChat(message, i + 1))
    .catch(() => message.message_id - i > 0 && clearChat(message, i + 1));
}

// express

app.get('/', (_req, res) => {
  res.status(200).end('bot start');
});

app.listen(PORT, () => {
  console.log(`Server start on port ${PORT}`);
  start();
});
