process.env['NTBA_FIX_350'] = 1;
require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const config = require('config');
const axios = require('axios').default;

const mongo = require('./my_modules/mongo');
const { textOptions } = require('./my_modules/messages');
const commandHandlers = require('./my_modules/commandHandlers');

const PORT = process.env.PORT || config.get('PORT');
const token = process.env.TOKEN || '';

const app = express();
const bot = new TelegramBot(token, { polling: true });

/**
 * Start tg bot
 */
function start() {
  try {
    mongo.connectToMongoDB();

    bot.on('message', (message) => {
      commandHandlers.allMessageHandler(bot, message);
    });

    Object.keys(textOptions).map((key) => {
      bot.onText(textOptions[key], (message) => {
        commandHandlers[`${key}Handler`](bot, message);
      });
    });

    bot.on('callback_query', (query) => {
      commandHandlers.callbackQueryHandler(bot, query);
    });
    bot.on('polling_error', console.log);
  } catch (error) {
    console.log(error?.body?.description);
  }
}

// refresher

function refresh() {
  axios.get('/refresh')
    .then(({ status }) => console.log(status))
    .catch((err) => {
      console.log(err);
    });
}

// express

app.get('/', (_req, res) => {
  res.status(200).end('bot start');
});

app.get('/refresh', (_req, res) => {
  res.status(200).end('refresh');
});

app.listen(PORT, () => {
  console.log(`Server start on port ${PORT}`);
  refresh();
  start();
});
