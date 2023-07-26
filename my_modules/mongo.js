require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const path = require('path');
const fs = require('fs');

const { messageList } = require("../my_modules/messages");
const { uploadPostPhoto } = require("../my_modules/google");

const mongoUri = process.env.MongoUri;

function connectToMongoDB() {
  mongoose.set("strictQuery", true);
  mongoose
    .connect(mongoUri)
    .then(() => console.log("Connect to mongodb"))
    .catch((e) => {
      console.error(e);
      console.log("Failed to connect to mongodb");
    });
}

function findUserById(id) {
  return User.findOne({ id });
}

async function search(page = 0, message, send, remove) {
  const loading_message = await send(message, messageList.search.loading);
  return await Post.find()
    .skip(page)
    .limit(1)
    .then(async (post) => {
      console.log(post);
      await remove(message, loading_message);
      return post;
    })
    .catch(async (e) => {
      await remove(message, loading_message);
      console.log(e);
      return null;
    });
}

async function searchById(message, id, send, remove) {
  const loading_message = await send(message, messageList.search.loading);
  return await Post.findById(id)
    .then(async (post) => {
      await remove(message, loading_message);
      return post;
    })
    .catch(async (e) => {
      await remove(message, loading_message);
      console.log(e);
      return null;
    });
}

async function login(userInfo) {
  const candidate = await findUserById(userInfo.id);
  if (!candidate) {
    const user = new User(userInfo);
    await user.save();
  }
}

async function postHandler(bot, message, send, remove) {
  const new_post = {
    title: "",
    description: "",
    price: "",
    photo: "",
    owner: message.from.id,
  };

  const post_title_prompt = await send(message, messageList.newPost.title, {
    reply_markup: { force_reply: true },
  });

  const checkConfirm = async () => {
    const confirm_prompt = await send(
      message,
      messageList.newPost.confirm(new_post),
      { reply_markup: { force_reply: true } }
    );
    return await bot.onReplyToMessage(
      message.chat.id,
      confirm_prompt.message_id,
      async (messageConfirm) => {
        if (messageConfirm.text === "да" || messageConfirm.text === "y") {
          return post(bot, new_post, message, send, remove);
        } else if (
          messageConfirm.text === "нет" ||
          messageConfirm.text === "n"
        ) {
          questionNow = false;
          return postHandler(bot, message, send, remove);
        } else {
          return checkConfirm();
        }
      }
    );
  };

  const messagePriceHandler = async (messagePrice) => {
    new_post.price = messagePrice.text;
    return await checkConfirm();
  };

  const messagePhotoHandler = async (messagePhoto) => {
    if (!messagePhoto?.document) {
      await send(message, messageList.newPost.photoError);

      const post_photo_prompt = await send(message, messageList.newPost.photo, {
        reply_markup: { force_reply: true },
      });

      return await bot.onReplyToMessage(
        message.chat.id,
        post_photo_prompt.message_id,
        messagePhotoHandler
      );
    }

    new_post.photo = messagePhoto.document;

    const post_price_prompt = await send(message, messageList.newPost.price, {
      reply_markup: { force_reply: true },
    });

    return await bot.onReplyToMessage(
      message.chat.id,
      post_price_prompt.message_id,
      messagePriceHandler
    );
  };

  const messageDescriptionHandler = async (messageDescription) => {
    new_post.description = messageDescription.text;

    const post_photo_prompt = await send(message, messageList.newPost.photo, {
      reply_markup: { force_reply: true },
    });

    return await bot.onReplyToMessage(
      message.chat.id,
      post_photo_prompt.message_id,
      messagePhotoHandler
    );

    // const post_price_prompt = await send(message, messageList.newPost.price, {
    //   reply_markup: { force_reply: true },
    // });

    // return await bot.onReplyToMessage(
    //   message.chat.id,
    //   post_price_prompt.message_id,
    //   messagePriceHandler
    // );
  };

  const messageTitleHandler = async (messageTitle) => {
    new_post.title = messageTitle.text;

    const post_description_prompt = await send(
      message,
      messageList.newPost.descriptions,
      { reply_markup: { force_reply: true } }
    );

    return await bot.onReplyToMessage(
      message.chat.id,
      post_description_prompt.message_id,
      messageDescriptionHandler
    );
  };

  return await bot.onReplyToMessage(
    message.chat.id,
    post_title_prompt.message_id,
    messageTitleHandler
  );
}

async function post(bot, postInfo, message, send, remove) {
  const cachePath = path.join(__dirname, "../", "cache")

  console.log(postInfo.photo);

  const loading_message = await send(message, messageList.newPost.loading);
  const filePath = await bot.downloadFile(postInfo.photo.thumbnail.file_id, cachePath)
  const photoDriveLink = await uploadPostPhoto(filePath, postInfo.photo);

  const cacheFilePath = path.join(cachePath, postInfo.photo.file_name)

  fs.unlinkSync(cacheFilePath)

  const post = new Post({
    ...postInfo,
    photo: photoDriveLink
  });

  return await post
    .save()
    .then(async (res) => {
      await remove(message, loading_message);
      await send(message, messageList.newPost.success);
      return res;
    })
    .catch(async (e) => {
      console.error(e);
      return await send(message, messageList.newPost.error);
    });
}

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
      if (e?.kind === "ObjectId") {
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
