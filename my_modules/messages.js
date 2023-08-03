const textOptions = {
  start: /^(\/start)$/,
  help: /^(\/h)$/,
  findPost: /^((\/f)||🔎Поиск)$/,
  findPostById: /^(\/fi)$/,
  newPost: /^((\/p)||📰Подать объявление)$/,
  deletePostById: /^((\/di)||🔥Удалить объявление)$/,
  myPosts: /^(\/myPosts)$/,
  myProfile: /^(\/myProfile)$/,
  cls: /^(\/cls)$/,

  findPostToVerify: /^((\/v)||✅Верификация)$/,
  findPostToVerifyByIdHandler: /^((\/vi)||✅Верификация по id)$/,
};

const messageList = {
  start: (name) => `Привет, ${name}!`,
  help: `Этот бот умеет:${getBotCan()}`,
  find: {
    end: 'Больше объявлений нет.',
    notFound: (id) => `Объявление с id '${id}' не найдено.`,
    loading: 'Ищу товар...',
  },
  newPost: {
    about: 'Опишите товар (Название, описание, состояние и т.д.):',
    price: 'Какая будет цена товара? (Br)',
    photo: 'Пришлите фото объявления в сжатом виде.',
    // eslint-disable-next-line
    confirm: (post) => `Все верно?\n\n${generateCaption(post, false)}\n\nНапишите "Да" или "Нет"`,
    success: 'Объявление успешно отправлено на модерацию!',
    photoError: 'Ошибка. Пришлите фото объявления в сжатом виде.',
    error: 'Что-то пошло не так.',
    publish: 'Ваше объявление успешно прошло модерацию и опубликовано!',
    deny: 'К сожалению ваше объявление не прошло модерацию и было отклонено.',
    loading: 'Публикую объявление...',
  },
  deletePost: {
    // eslint-disable-next-line
    noAccess: 'Вы не можете удалить это объявление, оно принадлежит другому пользователю.',
    success: 'Объявление успешно удалено!',
    notFound: (id) => `Объявление с id '${id}' не найдено.`,
    error: 'Что-то пошло не так.',
  },
  myPosts: 'Мои посты',
  myProfile: 'Мой профиль',
  // eslint-disable-next-line
  unidentified: 'Я вас не понимаю. Введите команду /h, чтобы узнать, что я умею.',

  admin: {
    postNotFound: (id) => `Объявление с id '${id}' не найдено.`,
    userNotFound: (id) => `Пользователь с id '${id}' не найден.`,
    noAccess: 'Нет доступа',
    findById: 'Введите id поста',
    acceptSuccess: 'Объявление успешно одобрено',
    denySuccess: 'Объявление успешно отклонено',
  },
  somethingWentWrong: 'Что-то пошло не так.',
};

/**
 * Get string about, what bot can do
 *
 * @return {String}
 */
function getBotCan() {
  const botCanList = {
    '🏁 /start': 'Запустить бота',
    '❔ /h': 'Узнать, что умеет бот',
    '🔎 /f': 'Поиск объявлений',
    '🔬 /fi [id]': 'Найти объявление по id',
    '📰 /p': 'Подать объявление',
    '🔥 /di [id]': 'Удалить объявление по id',
  };

  // "/myPosts": "Мои объявления",
  // "/myProfile": "Мой профиль",

  const result = Object.keys(botCanList).reduce((acc, cur) => {
    return acc + `\n${cur} - ${botCanList[cur]}`;
  }, '');
  return result;
}

/**
 * Check command text, is it unidentified
 *
 * @param {String} text
 * @return {Boolean}
 */
function checkIsUnidentified(text) {
  for (key in textOptions) {
    if (textOptions[key].test(text)) {
      return false;
    }
  }
  return true;
}

/**
 * Generate caption for post
 *
 * @param {*} post
 * @param {Boolean} withId
 * @return {String}
 */
function generateCaption(post, withId = true) {
  let result = '';

  if (withId) result += `_${post._id}_\n\n`;

  result += `${post.about}\n\n`;
  result += `Дата и время публикации:\n${post.date}\n\n`;
  result += `*${post.price}руб*`;
  result = result.split('.').join('\\.');

  return result;
}

module.exports = {
  textOptions,
  messageList,
  checkIsUnidentified,
  generateCaption,
};
