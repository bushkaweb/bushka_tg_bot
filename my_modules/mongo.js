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
 * Find posts by page
 *
 * @param {*} bot
 * @param {*} page
 * @param {*} message
 * @param {*} send
 * @param {*} remove
 * @param {*} findOptions
 * @return {*}
 */
async function find(
    bot, page, message,
    send, remove, findOptions = {isVerified: true},
) {
  const loadingMessage = await send(bot, message, messageList.find.loading);

  if (page < 0) {
    await remove(bot, message, loadingMessage);
    return [];
  }

  return await Post.find(findOptions)
      .limit(1)
      .sort({$natural: -1})
      .skip(page)
      .catch(async (error) => {
        console.log(error);
        return [];
      })
      .finally(async (result) => {
        await remove(bot, message, loadingMessage);
        return result;
      });
}

/**
 * find post by id
 *
 * @param {*} bot
 * @param {*} message
 * @param {*} id
 * @param {*} send
 * @param {*} remove
 * @param {*} findOptions
 * @return {*}
 */
async function findPostById(
    bot, message, id, send,
    remove, findOptions = {isVerified: true},
) {
  const loadingMessage = await send(bot, message, messageList.find.loading);
  return await Post.findOne({_id: id, ...findOptions})
      .catch(async (e) => {
        console.log(e);
        return [];
      })
      .finally((result) => {
        remove(bot, message, loadingMessage);
        return result;
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
    const user = new User({...userInfo, roles: ['USER']});
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
  const dateOptions = {
    'day': 'numeric',
    'month': 'numeric',
    'year': 'numeric',
    'hour': '2-digit',
    'minute': '2-digit',
  };

  const date = new Date().toLocaleDateString('ru', dateOptions);

  const newPost = {
    about: '',
    price: '',
    photo: '',
    owner: message.from.id,
    date,
    isVerified: false,
  };

  const checkConfirm = async () => {
    try {
      const options = {
        caption: messageList.newPost.confirm(newPost),
        reply_markup: {
          force_reply: true,
        },
        parse_mode: 'MarkdownV2',
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
    if (messagePhoto?.document || !messagePhoto.photo) {
      const postPhotoPrompt = await send(
          bot,
          message,
          messageList.newPost.photoError,
          {
            reply_markup: {force_reply: true},
          },
      );

      return await bot.onReplyToMessage(
          message.chat.id,
          postPhotoPrompt.message_id,
          messagePhotoHandler,
      );
    }

    newPost.photo = messagePhoto.photo[messagePhoto.photo.length - 1];

    const options = {
      reply_markup: {force_reply: true},
    };

    const postPricePrompt = await send(
        bot, message,
        messageList.newPost.price, options,
    );

    return await bot.onReplyToMessage(
        message.chat.id,
        postPricePrompt.message_id,
        messagePriceHandler,
    );
  };

  const messageAboutHandler = async (messageAbout) => {
    newPost.about = messageAbout.text;

    const options = {
      reply_markup: {force_reply: true},
    };

    const postPhotoPrompt = await send(
        bot, message,
        messageList.newPost.photo, options,
    );

    return await bot.onReplyToMessage(
        message.chat.id,
        postPhotoPrompt.message_id,
        messagePhotoHandler,
    );
  };

  const postAboutPrompt = await send(bot, message, messageList.newPost.about, {
    reply_markup: {force_reply: true},
  });

  return await bot.onReplyToMessage(
      message.chat.id,
      postAboutPrompt.message_id,
      messageAboutHandler,
  );
}

/**
 * Post a announcement to the MongoDb
 *
 * @param {*} bot
 * @param {*} postInfo
 * @param {*} message
 * @param {Function} send
 * @param {Function} remove
 * @return {*}
 */
async function post(bot, postInfo, message, send, remove) {
  const loadingMessage = await send(bot, message, messageList.newPost.loading);
  const photoDriveLink = await uploadPostPhoto(bot, postInfo.photo);

  if (!photoDriveLink) {
    return await send(bot, message, messageList.newPost.error);
  }

  const post = new Post({
    ...postInfo,
    photo: photoDriveLink,
  });

  return await post
      .save()
      .then(async (res) => {
        await remove(bot, message, loadingMessage);
        await send(bot, message, messageList.newPost.success);
        return res;
      })
      .catch(async (e) => {
        console.error(e);
        return await send(bot, message, messageList.newPost.error);
      });
}

/**
 * Remove post by id
 *
 * @param {*} bot
 * @param {*} message
 * @param {*} id
 * @param {*} send
 * @return {*}
 */
async function removePostById(bot, message, id, send) {
  return await Post.findById(id)
      .then(async (candidate) => {
        if (!candidate) {
          await send(bot, message, messageList.deletePost.notFound(id));
          return null;
        }

        const user = await findUserById(message.from.id);

        if (!user?._id) {
          await send(bot, message, messageList.deletePost.error);
          return null;
        }

        if (
          candidate.owner !== message.from.id &&
        !user.roles.includes('ADMIN')
        ) {
          await send(bot, message, messageList.deletePost.noAccess);
          return null;
        }

        return await Post.findByIdAndDelete(id)
            .then(async (post) => {
              await send(bot, message, messageList.deletePost.success);
              return post;
            })
            .catch(async (e) => {
              console.log(e);
              await send(bot, message, messageList.deletePost.error);
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

/* ----------------- ADMIN --------------- */

/**
 * [Admin function]
 * Verify post by id
 *
 * @param {*} id
 * @param {*} isVerified
 * @return {*}
 */
async function verifyPost(id, isVerified) {
  if (isVerified) {
    return Post.findByIdAndUpdate(id, {isVerified: true})
        .catch((e) => {
          console.log(e);
          return null;
        });
  }

  return Post.findByIdAndRemove(id)
      .catch((e) => {
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
  find,
  findPostById,

  verifyPost,
};
