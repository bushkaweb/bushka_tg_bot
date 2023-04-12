process.env["NTBA_FIX_350"] = 1;
require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const config = require("config");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch")

const {
  connectToMongoDB,
  login,
  postHandler,
  search,
  searchById,
  removePostById,
} = require("./my_modules/mongo");
const {
  textOptions,
  messageList,
  checkIsUnidentified,
} = require("./my_modules/messages");

const PORT = process.env.PORT || config.get("PORT");
const token = process.env.TOKEN || "";
const cachePath = path.join(__dirname, "../cache");

const app = express();
const bot = new TelegramBot(token, { polling: true });

let page = 0;

let prevPostMessage = null;

function start() {
  try {
    connectToMongoDB();

    bot.onText(textOptions.start, async (message) => {
      await send(message, messageList.start(message.from.first_name));
    });

    bot.onText(textOptions.help, async (message) => {
      await send(message, messageList.help);
    });

    bot.onText(textOptions.search, async (message) => {
      prevPostMessage = await searchHandle(message, prevPostMessage);
    });

    bot.onText(textOptions.searchById, async (message) => {
      await searchByIdHandle(message);
    });

    bot.onText(textOptions.newPost, async (message) => {
      await postHandler(bot, message, send, remove);
    });

    bot.onText(textOptions.deletePost, async (message) => {
      const postId = message.text.split(" ")[1];
      await removePostById(message, postId, send);
    });

    bot.onText(textOptions.myPosts, async (message) => {
      await send(message, messageList.myPosts);
    });

    bot.onText(textOptions.myProfile, async (message) => {
      await send(message, messageList.myProfile);
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

    bot.on("message", async (message) => {
      console.log(message.text);
      login(message.from);

      if (
        checkIsUnidentified(message.text) &&
        message?.reply_to_message?.from?.id !== 5980094782
      ) {
        await send(message, messageList.unidentified);
      }
    });

    bot.on("callback_query", async (query) => {
      switch (query.data) {
        case "prev_page":
          page -= page > 0 ? 1 : 0;
          prevPostMessage = await searchHandle(query.message, prevPostMessage);
          break;
        case "next_page":
          page += 1;
          prevPostMessage = await searchHandle(query.message, prevPostMessage);
          break;

        default:
          break;
      }
    });
  } catch (e) {
    console.error(e);
  }
}

async function searchHandle(message, prevPostMessage) {
  prevPostMessage && (await remove(message, prevPostMessage));
  const postList = await search(page, message, send, remove);

  if (!postList.length) {
    return await send(message, messageList.search.end, {
      reply_markup: {
        inline_keyboard: [[{ text: "Назад", callback_data: "prev_page" }]],
      },
    }).catch(() => {});
  }

  const caption = `${postList[0]._id}\n\n${postList[0].title}\n\n${postList[0].description}\n\n${postList[0].price} руб.`;
  const newFilePath = path.join(__dirname, "cache", "cache.png");

  if (postList[0].photo) {
    return await fetch(postList[0].photo)
      .then(async (res) => {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(newFilePath, buffer, { flag: "w+" });

        return await bot
          .sendPhoto(message.chat.id, newFilePath, {
            caption,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Назад", callback_data: "prev_page" },
                  { text: "Далее", callback_data: "next_page" },
                ],
              ],
            },
          })
      })
      .catch((e) => {
        console.log(e);
        return null;
      });
  }

  return await send(message, caption, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Назад", callback_data: "prev_page" },
          { text: "Далее", callback_data: "next_page" },
        ],
      ],
    },
  });
}

async function searchByIdHandle(message) {
  const id = message.text.split(" ")[1];
  const currentPost = await searchById(message, id, send, remove);
  if (!currentPost) {
    return await send(message, messageList.search.notFound);
  }
  const postMessage = `${currentPost._id}\n\n${currentPost.title}\n\n${currentPost.description}\n\n${currentPost.price} руб.`;
  return await send(message, postMessage);
}

async function send(message, text, props) {
  return await bot.sendMessage(message.chat.id, text, props);
}

async function remove(message, currentMessage) {
  return await bot.deleteMessage(message.chat.id, currentMessage.message_id);
}

// express

app.get("/", (req, res) => {
  res.end();
});

app.listen(PORT, () => {
  console.log(`Server start on port ${PORT}`);
  start();
});
