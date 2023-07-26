const textOptions = {
    start: /^(\/start)$/,
    help: /^(\/h)$/,
    search: /^(\/s)$/,
    searchById: /^(\/si \w+)$/,
    newPost: /^(\/p)$/,
    deletePost: /^(\/di \w+)$/,
    myPosts: /^(\/myPosts)$/,
    myProfile: /^(\/myProfile)$/,
    cls: /^(\/cls)$/
}

const messageList = {
    start: name => `Привет, ${name}!`,
    help: `Этот бот умеет:${getBotCan()}`,
    search: {
        end: "Больше объявлений нет.",
        notFound: "Объявление не найдено.",
        loading: "Ищу товар..."
    },
    newPost: {
        title: "Как будет называться объявление?",
        descriptions: "Какое будет описание у объявления? (необязательно)",
        price: "Какая будет цена товара? (Br)",
        photo: "Пришлите фото объявления(файлом).",
        confirm: post => `Все верно?\n\nНазвание: ${post.title}\nОписание: ${post.description}\nЦена: ${post.price}\n\n(да/нет)`,
        success: "Объявление успешно опубликовано!",
        photoError: "Ошибка. Пришлите фото объявления(файлом).",
        error: "Что-то пошло не так.",
        loading: "Публикую объявление...",
    },
    deletePost: {
        noAccess: "Вы не можете удалить это объявление, оно пренадлежит другому пользователю.",
        success: "Объявление успешно удалено!",
        notFound: (id) => `Объявление с id '${id}' не найдено.`,
        error: "Что-то пошло не так."
    },
    myPosts: "Мои посты",
    myProfile: "Мой профиль",
    unidentified: "Я вас не понимаю. Введите команду /h, чтобы узнать, что я умею."
}

function getBotCan() {
    const botCanList = {
        "/start": "Запустить бота",
        "/h": "Узнать, что умеет бот",
        "/s": "Поиск объявлений",
        "/si [id]": "Найти объявление по id",
        "/p": "Подать объявление",
        "/di [id]": "Удалить объявление по id",
    }

    // "/myPosts": "Мои объявления",
    // "/myProfile": "Мой профиль",

    const result = Object.keys(botCanList).reduce((acc, cur) => {
        return acc + `\n${cur} - ${botCanList[cur]}`
    }, "")
    return result
}

function checkIsUnidentified(text) {
    for (key in textOptions) {
        if (textOptions[key].test(text)) {
            return false
        }
    }
    return true
}

module.exports = { textOptions, messageList, checkIsUnidentified }