const {Schema, model} = require('mongoose');

const User = new Schema({
  id: {type: String, require: true},
  username: {type: String},
  first_name: {type: String},
  last_name: {type: String},
  roles: { type: Array },
  is_bot: {type: Boolean},
  language_code: {type: String},
});

const UserModel = model('User', User);

module.exports = UserModel;
