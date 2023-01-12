require('dotenv').config();
const mongoose = require('mongoose');
const config = require('config');
const User = require('../models/User');
const Post = require('../models/Post');

const { messageList } = require('../my_modules/messages')


const mongoUri = process.env.MongoUri

function connectToMongoDB() {
    mongoose.set('strictQuery', true);
    mongoose.connect(mongoUri)
        .then(() => console.log("Connect to mongodb"))
        .catch(e => {
            console.error(e);
            console.log("Failed to connect to mongodb")
        })
}

function findUserById(id) {
    return User.findOne({ id })
}

async function search(page = 0, message, send, remove) {
    const loading_message = await send(message, messageList.search.loading)
    return await Post.find()
        .skip(page)
        .limit(1)
        .then(async post => {
            await remove(message, loading_message)
            return post
        })
        .catch(async e => {
            await remove(message, loading_message)
            console.log(e);
            return null
        })

}

async function seachById(message, id, send, remove) {
    const loading_message = await send(message, messageList.search.loading)
    return await Post.findById(id)
        .then(async post => {
            await remove(message, loading_message)
            return post
        })
        .catch(async e => {
            await remove(message, loading_message)
            console.log(e);
            return null
        })
}

async function login(userInfo) {
    const candidate = await findUserById(userInfo.id)
    if (!candidate) {
        const user = new User(userInfo)
        await user.save()
    }

}

async function post(bot, message, send, remove) {
    const new_post = {
        title: "",
        description: "",
        price: "",
        owner: message.from.id
    }

    const post_title_prompt = await send(message, messageList.newPost.title, { reply_markup: { force_reply: true } })
    return await bot.onReplyToMessage(message.chat.id, post_title_prompt.message_id, async messageTitle => {
        console.log(message.chat.id, post_title_prompt.message_id);
        new_post.title = messageTitle.text

        const post_description_prompt = await send(message, messageList.newPost.descriptions, { reply_markup: { force_reply: true } })
        return await bot.onReplyToMessage(message.chat.id, post_description_prompt.message_id, async messageDescription => {
            new_post.description = messageDescription.text

            const post_price_prompt = await send(message, messageList.newPost.price, { reply_markup: { force_reply: true } })
            return await bot.onReplyToMessage(message.chat.id, post_price_prompt.message_id, async messagePrice => {
                new_post.price = messagePrice.text

                async function checkConfirm() {
                    const confirm_prompt = await send(message, messageList.newPost.confirm(new_post), { reply_markup: { force_reply: true } })
                    return await bot.onReplyToMessage(message.chat.id, confirm_prompt.message_id, async messageConfirm => {
                        if (messageConfirm.text === "да") {

                            const post = new Post(new_post)
                            const loading_message = await send(message, messageList.newPost.loading)
                            return await post.save()
                                .then(async res => {
                                    await remove(message, loading_message)
                                    await send(message, messageList.newPost.success)
                                    return res
                                })
                                .catch(async e => {
                                    console.error(e);
                                    return await send(message, messageList.newPost.error)
                                })

                        } else if (messageConfirm.text === "нет") {
                            questionNow = false
                            return post(bot, message, send, remove)
                        } else {
                            return checkConfirm()
                        }
                    })
                }

                return await checkConfirm()
            })
        })
    })
}

async function removePostById(message, id, send) {
    const candidate = await Post.findById(id)

    if (candidate.owner === message.from.id) {
        return await Post.findByIdAndDelete(id)
            .then(async post => {
                await send(message, messageList.deletePost.success)
                return post
            })
            .catch(async e => {
                console.log(e);
                await send(message, messageList.deletePost.error)
                return null
            })
    }

    await send(message, messageList.deletePost.noAccess)
    return null
}

module.exports = { connectToMongoDB, findUserById, login, post, removePostById, search, seachById }