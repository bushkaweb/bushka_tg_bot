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
      return await send(message, startMessageText);
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

    bot.onText(textOptions.cls, async (msg) => {
      const removeMessage = async (i = 0) => {
        return await bot
          .deleteMessage(msg.chat.id, msg.message_id - i)
          .then(() => removeMessage(i + 1))
          .catch(() => msg.message_id - i > 0 && removeMessage(i + 1));
      };
      removeMessage();
    });

    bot.on('message', async (message) => {
      checkClientInfo();

      console.log(message.chat.first_name, ':', '(', message.message_id, ')', message.text);

      if (message.message_id < 10) {
        login(message.chat);
      }
      
      if (checkIsUnidentified(message.text) && !message.reply_to_message) {
        await send(message, messageList.unidentified);
      }
    });

    bot.on('callback_query', async (query) => {
      if (!clientInfo[query.from.id]) {
        clientInfo[query.from.id] = { page: 0, prevMessage: null };
      }

      const currentMessage = clientInfo[query.from.id].prevMessage;

      const prevMessage = await searchHandle(query.message, currentMessage);

      switch (query.data) {
        case 'prev_page':
          clientInfo[query.from.id].page -= 1;
          clientInfo[query.from.id].prevMessage = prevMessage;
          break;
        case 'next_page':
          clientInfo[query.from.id].page += 1;
          clientInfo[query.from.id].prevMessage = prevMessage;
          break;

        default:
          break;
      }
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

  const currentPage = clientInfo[message.chat.id].page ?? 0;

  let postList = await search(currentPage, message, send, remove);

  if (!postList?.length) {
    if (clientInfo[message.chat.id].page < 0) {
      clientInfo[message.chat.id].page = -1;
      postList = await search(-1, message, send, remove);
    } else {
      clientInfo[message.chat.id].page = 0;
      postList = await search(0, message, send, remove);
    }
  }

  const currentPost = postList[0];

  const owner = await findUserById(currentPost.owner);

  let caption = '';
  let options = {};

  if (currentPost.contacts) {
    caption = `
    ${currentPost._id}
    ${currentPost.date ? '\n\n' + currentPost.date : ''}\n\n
    ${currentPost.title}\n\n
    ${currentPost.description}\n\n
    ${currentPost.contacts}\n\n
    ${currentPost.price} руб.
    `;

    options = {
      caption,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Назад', callback_data: 'prev_page' },
            { text: 'Далее', callback_data: 'next_page' },
          ],
        ],
      },
    };
  } else {
    caption = `
    ${currentPost._id}
    ${currentPost.date ? '\n\n' + currentPost.date : ''}\n\n
    ${currentPost.title}\n\n
    ${currentPost.description}\n\n
    ${currentPost.price} руб.
    `;

    options = {
      caption,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Связаться', url: `https://telegram.me/${owner.username}` },

          ],
          [
            { text: 'Назад', callback_data: 'prev_page' },
            { text: 'Далее', callback_data: 'next_page' },
          ],
        ],
      },
    };
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
  const postMessage = `
  ${currentPost._id}\n\n
  ${currentPost.title}\n\n
  ${currentPost.description}\n\n
  ${currentPost.price} руб.
  `;
  return await send(message, postMessage);
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

// express

app.get('/', (_req, res) => {
  res.status(200).end('bot start');
});

app.listen(PORT, () => {
  console.log(`Server start on port ${PORT}`);
  start();
});
