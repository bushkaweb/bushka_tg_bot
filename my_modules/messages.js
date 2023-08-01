const textOptions = {
  start: /^(\/start)$/,
  help: /^(\/h)$/,
  search: /^((\/s)||🔎Поиск)$/,
  searchById: /^(\/si \w+)$/,
  newPost: /^((\/p)||📰Подать объявление)$/,
  deletePost: /^(\/di \w+)$/,
  myPosts: /^(\/myPosts)$/,
  myProfile: /^(\/myProfile)$/,
  cls: /^(\/cls)$/,
};

const messageList = {
  start: (name) => `Привет, ${name}!`,
  help: `Этот бот умеет:${getBotCan()}`,
  search: {
    end: 'Больше объявлений нет.',
    notFound: 'Объявление не найдено.',
    loading: 'Ищу товар...',
  },
  newPost: {
    about: 'Опишите товар (Название, описание, состояние и т.д.):',
    price: 'Какая будет цена товара? (Br)',
    photo: 'Пришлите фото объявления в сжатом виде.',
    // eslint-disable-next-line
    confirm: (post) => `Все верно?\n\n${generateCaption(post, !!post.contacts, false)}\n\nНапишите "Да" или "Нет"`,
    // eslint-disable-next-line
    noUserName: 'В вашем профиле отсутствует уникальное имя,поэтому клиент не сможет связаться с вами. Отправьте свои контакты или напишите "Нет", чтобы отменить создание объявления.',
    success: 'Объявление успешно опубликовано!',
    photoError: 'Ошибка. Пришлите фото объявления в сжатом виде.',
    error: 'Что-то пошло не так.',
    loading: 'Публикую объявление...',
  },
  deletePost: {
    // eslint-disable-next-line
    noAccess: 'Вы не можете удалить это объявление, оно пренадлежит другому пользователю.',
    success: 'Объявление успешно удалено!',
    notFound: (id) => `Объявление с id '${id}' не найдено.`,
    error: 'Что-то пошло не так.',
  },
  myPosts: 'Мои посты',
  myProfile: 'Мой профиль',
  // eslint-disable-next-line
  unidentified: 'Я вас не понимаю. Введите команду /h, чтобы узнать, что я умею.',
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
    '🔎 /s': 'Поиск объявлений',
    '🔬 /si [id]': 'Найти объявление по id',
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
 * @param {Boolean} withContacts
 * @param {Boolean} withId
 * @return {String}
 */
function generateCaption(post, withContacts = false, withId = true) {
  let result = '';

  if (withId) result += `_${post._id}_\n\n`;

  if (withContacts) {
    result += `${post.about}\n\n`;
    result += `Контакты: ${post.contacts}\n\n`;
  } else {
    result += `${post.about}\n\n`;
  }

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
