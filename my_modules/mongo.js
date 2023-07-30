require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const path = require('path');
const fs = require('fs');
const uuid = require('uuid').v4;

const {messageList} = require('../my_modules/messages');
const {uploadPostPhoto} = require('../my_modules/google');

const mongoUri = process.env.MongoUri;
const cachePath = path.join(__dirname, '../', 'cache');

/**
 * Connect to MongoDB
 */
function connectToMongoDB() {
  mongoose.set('strictQuery', true);
  mongoose
      .connect(mongoUri)
      .then(() => console.log('Connect to mongodb'))
      .catch((e) => {
        console.error(e);
        console.log('Failed to connect to mongodb');
      });
}

/**
 * Find user by telegram id
 *
 * @param {Number} id
 * @return {*}
 */
function findUserById(id) {
  return User.findOne({id});
}

/**
 * Search posts by page
 *
 * @param {Number} page
 * @param {*} message
 * @param {Function} send
 * @param {Function} remove
 * @return {*}
 */
async function search(page, message, send, remove) {
  const loadingMessage = await send(message, messageList.search.loading);

  if (page < 0) {
    return await Post.find()
        .limit(1)
        .skip(-page - 1)
        .catch(console.log)
        .finally(async (result) => {
          await remove(message, loadingMessage);
          return result;
        });
  }

  return await Post.find()
      .limit(1)
      .sort({$natural: -1})
      .skip(page)
      .catch(console.log)
      .finally(async (result) => {
        await remove(message, loadingMessage);
        return result;
      });
}

/**
 * Search post by id
 *
 * @param {*} message
 * @param {Number} id
 * @param {Function} send
 * @param {Function} remove
 * @return {*}
 */
async function searchById(message, id, send, remove) {
  const loadingMessage = await send(message, messageList.search.loading);
  return await Post.findById(id)
      .then(async (post) => {
        await remove(message, loadingMessage);
        return post;
      })
      .catch(async (e) => {
        await remove(message, loadingMessage);
        console.log(e);
        return null;
      });
}

/**
 * Login user
 * Send info to MongoDb
 *
 * @param {*} userInfo
 */
async function login(userInfo) {
  const candidate = await findUserById(userInfo.id);
  if (!candidate) {
    const user = new User(userInfo);
    await user.save();
  }
}

/**
 * Handle post a post
 *
 * @param {*} bot
 * @param {*} message
 * @param {Function} send
 * @param {Function} remove
 * @return {*}
 */
async function postHandler(bot, message, send, remove) {
  const newPost = {
    title: '',
    description: '',
    price: '',
    photo: '',
    owner: message.from.id,
    date: '',
  };

  const checkConfirm = async () => {
    try {
      const options = {
        caption: messageList.newPost.confirm(newPost),
        reply_markup: {
          force_reply: true,
        },
      };

      if (!fs.existsSync(cachePath)) {
        fs.mkdirSync(cachePath);
      }

      const cacheFileDir = uuid();
      const cacheFileDirPath = path.join(cachePath, cacheFileDir);

      if (!fs.existsSync(cacheFileDirPath)) {
        fs.mkdirSync(cacheFileDirPath);
      }

      const fileId = newPost.photo.file_id;
      const chatId = message.chat.id;

      const filePath = await bot.downloadFile(fileId, cacheFileDirPath);
      const confirmPrompt = await bot.sendPhoto(chatId, filePath, options);

      fs.unlinkSync(filePath);
      fs.rmdirSync(cacheFileDirPath);

      return await bot.onReplyToMessage(
          message.chat.id,
          confirmPrompt.message_id,
          async (messageConfirm) => {
            if (
              messageConfirm.text.toUpperCase() === 'ДА' ||
            messageConfirm.text === 'y'
            ) {
              return post(bot, newPost, message, send, remove);
            } else if (
              messageConfirm.text.toUpperCase() === 'НЕТ' ||
            messageConfirm.text === 'n'
            ) {
              questionNow = false;
              return postHandler(bot, message, send, remove);
            } else {
              return checkConfirm();
            }
          },
      );
    } catch (e) {
      console.log(e);
      return null;
    }
  };

  const messagePriceHandler = async (messagePrice) => {
    newPost.price = messagePrice.text;
    return await checkConfirm();
  };

  const messagePhotoHandler = async (messagePhoto) => {
    if (messagePhoto?.document) {
      await send(message, messageList.newPost.photoError);

      const postPhotoPrompt = await send(message, messageList.newPost.photo, {
        reply_markup: {force_reply: true},
      });

      return await bot.onReplyToMessage(
          message.chat.id,
          postPhotoPrompt.message_id,
          messagePhotoHandler,
      );
    }

    newPost.photo = messagePhoto.photo[messagePhoto.photo.length - 1];

    const postPricePrompt = await send(message, messageList.newPost.price, {
      reply_markup: {force_reply: true},
    });

    return await bot.onReplyToMessage(
        message.chat.id,
        postPricePrompt.message_id,
        messagePriceHandler,
    );
  };

  const messageDescriptionHandler = async (messageDescription) => {
    newPost.description = messageDescription.text;

    const postPhotoPrompt = await send(message, messageList.newPost.photo, {
      reply_markup: {force_reply: true},
    });

    return await bot.onReplyToMessage(
        message.chat.id,
        postPhotoPrompt.message_id,
        messagePhotoHandler,
    );
  };

  const messageTitleHandler = async (messageTitle) => {
    newPost.title = messageTitle.text;

    const postDescriptionPrompt = await send(
        message,
        messageList.newPost.descriptions,
        {reply_markup: {force_reply: true}},
    );

    return await bot.onReplyToMessage(
        message.chat.id,
        postDescriptionPrompt.message_id,
        messageDescriptionHandler,
    );
  };

  const messageContactsHandler = async (messageContacts) => {
    if (messageContacts.text.toUpperCase() === 'НЕТ') {
      return null;
    }

    const postTitlePrompt = await send(message, messageList.newPost.title, {
      reply_markup: {force_reply: true},
    });

    newPost.contacts = messageContacts.text;

    return await bot.onReplyToMessage(
        message.chat.id,
        postTitlePrompt.message_id,
        messageTitleHandler,
    );
  };

  if (message.from.username) {
    const postTitlePrompt = await send(message, messageList.newPost.title, {
      reply_markup: {force_reply: true},
    });

    return await bot.onReplyToMessage(
        message.chat.id,
        postTitlePrompt.message_id,
        messageTitleHandler,
    );
  }

  const postContactsPrompt = await send(
      message,
      messageList.newPost.noUserName, {
        reply_markup: {force_reply: true},
      },
  );

  return await bot.onReplyToMessage(
      message.chat.id,
      postContactsPrompt.message_id,
      messageContactsHandler,
  );
}

/**
 * Post a post to the MongoDb
 *
 * @param {*} bot
 * @param {*} postInfo
 * @param {*} message
 * @param {Function} send
 * @param {Function} remove
 * @return {*}
 */
async function post(bot, postInfo, message, send, remove) {
  const loadingMessage = await send(message, messageList.newPost.loading);
  const photoDriveLink = await uploadPostPhoto(bot, postInfo.photo);

  const dateOptions = {
    'day': 'numeric',
    'month': 'numeric',
    'year': 'numeric',
    'hour': '2-digit',
    'minute': '2-digit',
  };

  const date = new Date().toLocaleDateString('ru', dateOptions);

  const post = new Post({
    ...postInfo,
    date,
    photo: photoDriveLink,
  });

  return await post
      .save()
      .then(async (res) => {
        await remove(message, loadingMessage);
        await send(message, messageList.newPost.success);
        return res;
      })
      .catch(async (e) => {
        console.error(e);
        return await send(message, messageList.newPost.error);
      });
}

/**
 * Remove post by id
 *
 * @param {*} message
 * @param {Number} id
 * @param {Function} send
 * @return {*}
 */
async function removePostById(message, id, send) {
  return await Post.findById(id)
      .then(async (candidate) => {
        if (!candidate) {
          await send(message, messageList.deletePost.notFound(id));
          return null;
        }

        if (candidate.owner !== message.from.id) {
          await send(message, messageList.deletePost.noAccess);
          return null;
        }

        return await Post.findByIdAndDelete(id)
            .then(async (post) => {
              await send(message, messageList.deletePost.success);
              return post;
            })
            .catch(async (e) => {
              console.log(e);
              await send(message, messageList.deletePost.error);
              return null;
            });
      })
      .catch(async (e) => {
        if (e?.kind === 'ObjectId') {
          await send(message, messageList.deletePost.notFound(id));
        }

        console.log(e);
        return null;
      });
}

module.exports = {
  connectToMongoDB,
  findUserById,
  login,
  postHandler,
  post,
  removePostById,
  search,
  searchById,
};
