require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const config = require('config');

const { connectToMongoDB, login, post, search, seachById, removePostById } = require('./my_modules/mongo');
const { textOptions, messageList, checkIsUnidentified } = require('./my_modules/messages')

const PORT = process.env.PORT || config.get("PORT")
const token = process.env.TOKEN || ""

const app = express()
const bot = new TelegramBot(token, { polling: true });

let page = 0

let prevPostMessage = null

function start() {

    try {
        connectToMongoDB()

        bot.onText(textOptions.start, async message => {
            await send(message, messageList.start(message.from.first_name))
        })

        bot.onText(textOptions.help, async message => {
            await send(message, messageList.help)
        })

        bot.onText(textOptions.search, async message => {
            prevPostMessage = await searchHandle(message, prevPostMessage)
        })

        bot.onText(textOptions.searchById, async message => {
            await searchByIdHandle(message)
        })

        bot.onText(textOptions.newPost, async message => {
            await post(bot, message, send, remove)
        })

        bot.onText(textOptions.deletePost, async message => {
            const postId = message.text.split(" ")[1]
            await removePostById(message, postId, send)
        })

        bot.onText(textOptions.myPosts, async message => {
            await send(message, messageList.myPosts)
        })

        bot.onText(textOptions.myProfile, async message => {
            await send(message, messageList.myProfile)
        })

        bot.on("message", async message => {
            console.log(message.text);
            login(message.from)

            if (checkIsUnidentified(message.text) && message?.reply_to_message?.from?.id !== 5980094782) {
                await send(message, messageList.unidentified)
            }
        })

        bot.on("callback_query", async query => {
            switch (query.data) {
                case "prev_page":
                    page -= page > 0 ? 1 : 0
                    prevPostMessage = await searchHandle(query.message, prevPostMessage)
                    break;
                case "next_page":
                    page += 1
                    prevPostMessage = await searchHandle(query.message, prevPostMessage)
                    break;

                default:
                    break;
            }
        })
    } catch (e) {
        console.error(e);
    }
}

async function searchHandle(message, prevPostMessage) {
    prevPostMessage && await remove(message, prevPostMessage)
    const postList = await search(page, message, send, remove)

    if (!postList.length) {
        return await send(message, messageList.search.end, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "Назад", callback_data: "prev_page" }
                    ]
                ]
            }
        })
    }

    const postMessage = `${postList[0]._id}\n\n${postList[0].title}\n\n${postList[0].description}\n\n${postList[0].price} руб.`
    return await send(message, postMessage, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "Назад", callback_data: "prev_page" },
                    { text: "Далее", callback_data: "next_page" }
                ]
            ]
        }
    })
}

async function searchByIdHandle(message) {
    const id = message.text.split(" ")[1]
    const currentPost = await seachById(message, id, send, remove)
    if (!currentPost) {
        return await send(message, messageList.search.notFound)
    }
    const postMessage = `${currentPost._id}\n\n${currentPost.title}\n\n${currentPost.description}\n\n${currentPost.price} руб.`
    return await send(message, postMessage)
}

async function send(message, text, props) {
    return await bot.sendMessage(message.chat.id, text, props)

}

async function remove(message, currentMessage) {
    return await bot.deleteMessage(message.chat.id, currentMessage.message_id)
}

// express

app.get("/", (req, res) => {
    res.end()
})

app.listen(PORT, () => {
    console.log(`Server start on port ${PORT}`);
    start()
})