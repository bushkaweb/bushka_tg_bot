const myMessages = require('./messages');
const mongo = require('./mongo');

const clientInfo = {};

/**
 * Start command handler
 *
 * @param {*} bot
 * @param {*} message
 */
async function startHandler(bot, message) {
  const text = myMessages.messageList.start(message.from.first_name);
  const options = {
    reply_markup: {
      keyboard: [
        [
          {text: '🔎Поиск'},
          {text: '📰Подать объявление'},
          {text: '🔥Удалить объявление'},
        ],
      ],
      resize_keyboard: true,
    },
  };

  const user = await mongo.findUserById(message.from.id);

  if (!user) {
    await mongo.login(message.from)
  }

  if (user.roles.includes('ADMIN')) {
    options.reply_markup.keyboard.push([
      {text: '✅Верификация'},
      {text: '✅Верификация по id'},
    ]);
    send(bot, message, text, options);
    return;
  }

  send(bot, message, text, options);
}

/**
 * Help command handler
 *
 * @param {*} bot
 * @param {*} message
 */
function helpHandler(bot, message) {
  send(bot, message, myMessages.messageList.help);
}

/**
 * find command handler
 *
 * @param {*} bot
 * @param {*} message
 * @param {*} findOptions
 * @return {*}
 */
async function findPostHandler(bot, message, findOptions = {isVerified: true}) {
  checkClientInfo(message.chat.id);

  const currentPage = clientInfo[message.chat.id].page;

  let postList = await mongo.find(
      bot, currentPage, message,
      send, remove, findOptions,
  );

  if (!postList.length) {
    clientInfo[message.chat.id].page = 0;
    postList = await mongo.find(bot, 0, message, send, remove, findOptions);

    if (!postList.length) {
      const messageEnd = myMessages.messageList.find.end;
      send(bot, message, messageEnd);
      return;
    }
  }

  const currentMessage = clientInfo[message.chat.id].prevMessage;

  if (currentMessage) {
    await remove(bot, message, currentMessage);
  }

  const currentPost = postList[0];

  const user = await mongo.findUserById(message.chat.id);
  const owner = await mongo.findUserById(currentPost.owner);

  const caption = myMessages.generateCaption(currentPost);
  const options = {
    caption,
    reply_markup: {
      inline_keyboard: [
        [
          {text: 'Связаться', url: `tg://user?id=${owner.id}`},
        ],
        [
          {
            text: 'Назад',
            callback_data: findOptions.isVerified ?
              'prev_page' :
              'prev_page_verify',
          },
          {
            text: 'Далее',
            callback_data: findOptions.isVerified ?
              'next_page' :
              'next_page_verify',
          },
        ],
      ],
    },
    parse_mode: 'MarkdownV2',
  };

  if (user.roles.includes('ADMIN') && !findOptions.isVerified) {
    options.reply_markup.inline_keyboard = [
      options.reply_markup.inline_keyboard[0],
      [
        {text: 'Одобрить', callback_data: 'accept'},
        {text: 'Отклонить', callback_data: 'deny'},
      ],
      options.reply_markup.inline_keyboard[1],
    ];
  }

  const photoLink = postList[0].photo;

  if (!photoLink) {
    send(bot, message, caption, options);
    return;
  }

  const prevMessage = await sendPhoto(bot, message, currentPost, options);

  clientInfo[message.chat.id].prevMessage = prevMessage;

  return prevMessage;
}

/**
 * find post by id command handler
 *
 * @param {*} bot
 * @param {*} message
 * @param {*} findOptions
 * @return {*}
 */
async function findPostByIdHandler(
    bot, message, findOptions = {isVerified: true},
) {
  const postIdHandler = async (messagePostId) => {
    const post = await mongo.findPostById(
        bot,
        message,
        messagePostId.text,
        send,
        remove,
        findOptions,
    );

    if (!post) {
      const text = myMessages.messageList.find.notFound(messagePostId.text);
      send(bot, message, text);
      return;
    }

    const caption = myMessages.generateCaption(post);
    const options = {caption, parse_mode: 'MarkdownV2'};
    return await sendPhoto(bot, message, post, options);
  };

  if (findOptions._id) {
    return await postIdHandler({text: findOptions._id});
  }

  const postIdPrompt = send(
      bot, message,
      myMessages.messageList.admin.findById, findOptions,
  );
  return await bot.onReplyToMessage(
      message.chat.id,
      postIdPrompt.message_id,
      postIdHandler,
  );
}

/**
 * Create new post command handler
 *
 * @param {*} bot
 * @param {*} message
 */
async function newPostHandler(bot, message) {
  mongo.postHandler(bot, message, send, remove);
}

/**
 * Delete post command handler
 *
 * @param {*} bot
 * @param {*} message
 * @return {*}
 */
async function deletePostByIdHandler(bot, message) {
  const postIdHandler = async (messagePostId) => {
    mongo.removePostById(bot, message, messagePostId.text, send);
  };

  const options = {reply_markup: {force_reply: true}};

  const postIdPrompt = await send(
      bot, message,
      myMessages.messageList.admin.findById, options,
  );
  return await bot.onReplyToMessage(
      message.chat.id,
      postIdPrompt.message_id,
      postIdHandler,
  );
}

/**
 * My posts command handler
 *
 * @param {*} bot
 * @param {*} message
 */
function myPostsHandler(bot, message) {
  send(bot, message, myMessages.messageList.myPosts);
}

/**
 * My profile command handler
 *
 * @param {*} bot
 * @param {*} message
 */
function myProfileHandler(bot, message) {
  send(bot, message, myMessages.messageList.myProfile);
}

/**
 * Clear chat command handler
 *
 * @param {*} bot
 * @param {*} message
 */
function clsHandler(bot, message) {
  clearChat(bot, message);
}

/**
 * All messages command handler
 *
 * @param {*} bot
 * @param {*} message
 */
async function allMessageHandler(bot, message) {
  await mongo.login(message.from)
  checkClientInfo();

  if (
    myMessages.checkIsUnidentified(message.text) &&
    !message.reply_to_message
  ) {
    send(bot, message, myMessages.messageList.unidentified);
  }
}

/**
 * Callback query command handler
 *
 * @param {*} bot
 * @param {*} query
 */
async function callbackQueryHandler(bot, query) {
  if (!clientInfo[query.from.id]) {
    clientInfo[query.from.id] = {page: 0, prevMessage: null};
  }

  const currentPage = clientInfo[query.from.id].page;

  let prevMessage;

  switch (query.data) {
    case 'prev_page':
      clientInfo[query.from.id].page = (currentPage - 1) || 0;
      prevMessage = await findPostHandler(bot, query.message);
      break;
    case 'next_page':
      clientInfo[query.from.id].page += 1;
      prevMessage = await findPostHandler(bot, query.message);
      break;
    case 'prev_page_verify':
      clientInfo[query.from.id].page = (currentPage - 1) || 0;
      prevMessage = await findPostHandler(
          bot, query.message,
          {isVerified: false},
      );
      break;
    case 'next_page_verify':
      clientInfo[query.from.id].page += 1;
      prevMessage = await findPostHandler(
          bot, query.message,
          {isVerified: false},
      );
      break;
    case 'accept':
      verifyPostHandler(bot, query.message, true);
      break;
    case 'deny':
      verifyPostHandler(bot, query.message, false);
      break;

    default:
      break;
  }

  const regexp = /^(find_post_\w+)$/;

  if (regexp.test(query.data)) {
    clientInfo[query.message.chat.id].page = 0;
    const findOptions = {_id: query.data.split('_')[2], isVerified: true};
    await findPostByIdHandler(bot, query.message, findOptions);
  }

  clientInfo[query.from.id].prevMessage = prevMessage;
}

/* ------------------------ ADMIN ---------------------- */

/**
 * [Admin function] [private]
 * Verify post handler
 *
 * @param {*} bot
 * @param {*} postMessage
 * @param {Boolean} state
 */
async function verifyPostHandler(bot, postMessage, state) {
  const postId = postMessage.caption.split('\n')[0];

  const post = await mongo.verifyPost(postId, state);

  if (!post) {
    send(
        bot, postMessage,
        myMessages.messageList.somethingWentWrong,
    );
    return;
  }

  const text = myMessages.messageList.admin[
    state ? 'acceptSuccess' : 'denySuccess'
  ];

  send(bot, postMessage, text);

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Посмотреть объявление',
            callback_data: `find_post_${post._id}`,
          },
        ],
      ],
    },
  };

  if (state) {
    const text = myMessages.messageList.newPost.publish;
    bot.sendMessage(post.owner, text, options);
  } else {
    const text = myMessages.messageList.newPost.deny;
    bot.sendMessage(post.owner, text);
  }
}

/**
 * [Admin function]
 * find post to verify handler
 *
 * @param {*} bot
 * @param {*} message
 */
function findPostToVerifyHandler(bot, message) {
  findPostHandler(bot, message, {isVerified: false});
}

/**
 * [Admin function]
 * Verify post by id handler
 *
 * @param {*} bot
 * @param {*} message
 * @return {*}
 */
async function findPostToVerifyByIdHandler(bot, message) {
  const user = await mongo.findUserById(message.from.id);

  if (!user) {
    console.log('[verifyHandler] User not found');
    send(
        bot, message,
        myMessages.messageList.admin.userNotFound(message.from.id),
    );
    return;
  }

  if (!user.roles.includes('ADMIN')) {
    console.log('[verifyHandler] No access');
    send(bot, message, myMessages.admin.noAccess);
    return;
  }

  const postIdHandler = async (messagePostId) => {
    const findOptions = {
      isVerified: false,
    };

    const post = await mongo.findPostById(
        bot,
        message,
        messagePostId.text,
        send,
        remove,
        findOptions,
    );

    if (!post) {
      const text = myMessages.messageList
          .admin.postNotFound(messagePostId.text);

      send(bot,
          message,
          text,
      );
      return;
    }

    const owner = await mongo.findUserById(post.owner);
    const caption = myMessages.generateCaption(post);

    const options = {
      caption,
      reply_markup: {
        inline_keyboard: [
          [
            {text: 'Связаться', url: `tg://user?id=${owner.id}`},
          ],
          [
            {text: 'Одобрить', callback_data: 'accept'},
            {text: 'Отклонить', callback_data: 'deny'},
          ],
        ],
      },
      parse_mode: 'MarkdownV2',
    };

    sendPhoto(bot, message, post, options);
  };

  const options = {
    reply_markup: {
      force_reply: true,
    },
  };

  const postIdPrompt = await send(
      bot, message,
      myMessages.messageList.admin.findById, options,
  );
  return await bot.onReplyToMessage(
      message.chat.id,
      postIdPrompt.message_id,
      postIdHandler,
  );
}

/* ------------------------ OTHER ---------------------- */

/**
 * [private]
 * Send message
 *
 * @param {*} bot
 * @param {*} message
 * @param {*} text
 * @param {*} props
 * @return {*}
 */
async function send(bot, message, text, props) {
  return await bot.sendMessage(message.chat.id, text, props);
}

/**
 * [private]
 * Send photo
 *
 * @param {*} bot
 * @param {*} message
 * @param {*} post
 * @param {*} options
 * @return {*}
 */
async function sendPhoto(bot, message, post, options) {
  return await bot.sendPhoto(message.chat.id, post.photo, options);
}

/**
 * Clear chat
 *
 * @param {*} bot
 * @param {*} message
 * @param {*} i
 * @return {*}
 */
function clearChat(bot, message, i = 0) {
  return bot
      .deleteMessage(message.chat.id, message.message_id - i)
      .then(() => clearChat(bot, message, i + 1))
      .catch(
          () => message.message_id - i > 0 &&
        clearChat(bot, message, i + 1),
      );
}

/**
 * [private]
* Check client info and fill it
*
* @param {Number} id
* @return {undefined}
*/
function checkClientInfo(id) {
  if (clientInfo[id]) return;

  clientInfo[id] = {page: 0, prevMessage: null};
  return;
}

/**
 * [private]
 * Remove message
 *
 * @param {*} bot
 * @param {*} message
 * @param {*} currentMessage
 * @return {*}
 */
async function remove(bot, message, currentMessage) {
  const chatId = message.chat.id;
  const messageId = currentMessage.message_id;
  return await bot.deleteMessage(chatId, messageId).catch(console.log);
}

module.exports = {
  startHandler,
  helpHandler,
  findPostHandler,
  findPostByIdHandler,
  newPostHandler,
  deletePostByIdHandler,
  myPostsHandler,
  myProfileHandler,
  clsHandler,
  allMessageHandler,
  callbackQueryHandler,
  verifyPostHandler,
  findPostToVerifyHandler,
  findPostToVerifyByIdHandler,
};
