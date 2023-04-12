const { Schema, model } = require('mongoose');

const Post = new Schema({
    title: { type: String, require: true },
    description: { type: String },
    photo: {type: String},
    price: { type: Number, require: true },
    owner: { type: Number, require: true }
})

const PostModel = model('Post', Post)

module.exports = PostModel

