const {Schema, model} = require('mongoose');

const Post = new Schema({
  about: {type: String, require: true},
  photo: {type: String},
  price: {type: Number, require: true},
  owner: {type: Number, require: true},
  date: {type: String, require: true},
});

const PostModel = model('Post', Post);

module.exports = PostModel;

