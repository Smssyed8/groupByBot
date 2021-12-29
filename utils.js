// TODO: refactor this whole file!

const Expense = require('./model/expense')
    , cfg = require('./config.json')
    , fs = require('fs')
    , os = require('os')
    , path = require('path')
    , db = require("./db")
    , safeEval = require('safe-eval-2')

function parseExpenseInput(messageText) {
    var msg = [...(messageText)]
    //console.log("hi 0 ", messageText);
    var msg = messageText.split("#");
    console.log("hi 0 ", msg[0]);
    console.log("hi 1 ", msg[1]);
    console.log("hi 2 ", msg[2]);
    console.log("hi 3 ", msg[3]);
    //const commandRe = /^([\w ]*[^\W_][\w ] (#[a-zA-Z_]*))*$/g
    const firstArg = /^[\s\S]*([a-zA-Z_0-9]+)?$/g
    const secondArg = /^[\s\S]*([a-zA-Z_0-9]+)?$/g
    const thirdArg = /^[\s\S]+([^#]+)?$/g
    if (!msg[1] || !msg[2] || !msg[3]) {
        return null;
    }

    const firstArgVal = firstArg.test(msg[1].trim())
    const secondArgVal = secondArg.test(msg[2].trim())
    const thirdArgVal = thirdArg.test(msg[3].trim())
    console.log("firstArgVal", firstArgVal);
    console.log("secondArgVal", secondArgVal);
    console.log("thirdArgVal", thirdArgVal);

    if (!firstArgVal || !secondArgVal || !thirdArgVal) {
        return null;
    }

    return [
        msg[1].trim(),        // category
        msg[2].trim(),// subcategory
        msg[3].trim() || ''   // description
    ]
}

function makeQuery(args, user) {
    if (!user) return false

    const y = new Date().getFullYear()
    const m = new Date().getMonth()
    const d = new Date().getDay()
    const date = new Date().getDate()

    let cat, from, to

    if (/^#\w+$/.test(args[0]) && !args[1]) {
        // /get #food
        from = new Date(y, m, 1),
            to = new Date(y, m + 1, 1),
            cat = args[0]
    } else if (/^[A-Za-z]+$/.test(args[0]) && !args[1]) {
        // /get january
        const capitalized = capitalize(args[0])

        if (cfg.MONTHS.hasOwnProperty(capitalized)) {
            const month = cfg.MONTHS[capitalized]
            const year = y - (m - month < 0)
            from = new Date(year, month, 1),
                to = new Date(year, month + 1, 1)
        } else if (cfg.WEEKDAYS.hasOwnProperty(capitalized)) {
            const day = d - cfg.WEEKDAYS[capitalized]
            from = new Date(y, m, date - day),
                to = new Date(y, m, date - day + 1)
        }
    } else if (/^[A-Za-z]+$/.test(args[0]) && /^#\w+$/.test(args[1])) {
        // /get january #food
        const capitalized = capitalize(args[0])

        if (cfg.MONTHS.hasOwnProperty(capitalized)) {
            const month = cfg.MONTHS[capitalized]
            const year = y - (m - month < 0)
            from = new Date(year, month, 1),
                to = new Date(year, month + 1, 1)
        }
        else if (cfg.WEEKDAYS.hasOwnProperty(capitalized)) {
            const day = d - cfg.WEEKDAYS[capitalized]
            from = new Date(y, m, date - day),
                to = new Date(y, m, date - day + 1)
        }
        cat = args[1]
    } else if (/^[A-Za-z]+$/.test(args[1]) && /^#\w+$/.test(args[0])) {
        // /get #food january
        const capitalized = capitalize(args[1])

        if (cfg.MONTHS.hasOwnProperty(capitalized)) {
            const month = cfg.MONTHS[capitalized]
            const year = y - (m - month < 0)
            from = new Date(year, month, 1),
                to = new Date(year, month + 1, 1)
        }
        else if (cfg.WEEKDAYS.hasOwnProperty(capitalized)) {
            const day = d - cfg.WEEKDAYS[capitalized]
            from = new Date(y, m, date - day),
                to = new Date(y, m, date - day + 1)
        }
        cat = args[0]
    }

    let query = {
        timestamp: { $lt: to, $gte: from },
        user: user,
        $or: [
            { isTemplate: { $exists: false } },
            { isTemplate: false }
        ]
    }
    if (cat) {
        query = { ...query, category: cat }
    }
    return query
}

function findExpenses(message, args, callback) {
    let query = makeQuery(args, message.chat.id)
    if (!query) return callback(true, null)

    db
        .getCollection()
        .find(query)
        .toArray((err, all) => {
            if (err) return callback(err)
            let expenses = all.map(
                item => new Expense(
                    item.user,
                    item.category,
                    item.subcategory,
                    item.description,
                    item.timestamp,
                    item.ref
                )
            )
            callback(null, expenses)
        })
}

function summarizeExpenses(message, args, callback) {
    let query = makeQuery(args, message.chat.id)
    if (!query) return callback(true, null)

    const category = query.category
    delete query.category

    db
        .getCollection()
        .aggregate([
            { $match: query },
            { $group: { _id: "$category" } }
        ])
        .toArray((err, all) => {
            if (err) return callback(err)

            all = all.filter(e => !category || e._id === category)
            all = all.map(e => Object.assign(e, { _id: e._id || 'uncategorized' }))
            all.sort((e1, e2) => e1._id.localeCompare(e2._id))

            callback(null, all)
        })
}

function deleteExpenses(message, args, callback) {
    let query = makeQuery(args, message.chat.id)
    if (!query) return callback(true, null)
    db
        .getCollection()
        .remove(query, callback)
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
}

function asCsv(expenses) {
    const header = `category,subcategory,description,date,timestamp`
    const body = expenses
        .map(e => [e.category, e.subcategory, e.description, e.timestamp, e.timestamp.getTime()].join(','))
        .join('\n')
    return `${header}\n${body}`
}

function writeTempFile(fileName, content) {
    const filePath = path.join(os.tmpdir(), fileName)
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, content, err => {
            if (err) {
                return reject(err)
            }
            return resolve(filePath)
        })
    })
}

function deleteFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, err => {
            if (err) {
                return reject(err)
            }
            return resolve()
        })
    })
}

async function countExpenses() {
    return await db
        .getCollection()
        .estimatedDocumentCount()
}

async function countUsers() {
    const result = await db
        .getCollection()
        .aggregate([
            { $group: { _id: "$user" } },
            { $group: { _id: null, count: { $sum: 1 } } },
        ])
        .toArray()

    return result.length === 1
        ? result[0].count
        : 0
}

async function countCategories() {
    const result = await db
        .getCollection()
        .aggregate([
            { $group: { _id: "$category" } },
            { $group: { _id: null, count: { $sum: 1 } } },
        ])
        .toArray()

    return result.length === 1
        ? result[0].count
        : 0
}

async function getActiveUsers() {
    const startDate = new Date(new Date().setDate(new Date().getDate() - 7));

    const result = await db
        .getCollection()
        .aggregate([
            { $match: { timestamp: { $gt: startDate } } },
            { $group: { _id: "$user", count: { $sum: 1 } } },
        ])
        .toArray()

    return result
        .map(e => e._id)
}

async function sumTotal() {
    const result = await db
        .getCollection()
        .aggregate([
            {
                $match: {
                    $and: [
                        { amount: { $gte: -10000 } },
                        { amount: { $lte: 10000 } },
                        {
                            $or: [
                                { isTemplate: { $exists: false } },
                                { isTemplate: false },
                            ],
                        },
                    ],
                },
            },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray()

    return result.length === 1
        ? result[0].total
        : 0
}

function round(value, places) {
    if (!value) return null
    const power = Math.pow(10, places);
    return Math.round(value * power) / power;
}

function tryEval(command) {
    try {
        return safeEval(command)
    } catch (e) {
        return null
    }
}

// day of year
// https://stackoverflow.com/a/8619946/3112139
function doy(date) {
    const start = new Date(date.getFullYear(), 0, 0)
    const diff = (date - start) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000)
    const oneDay = 1000 * 60 * 60 * 24
    return Math.floor(diff / oneDay)
}

module.exports = {
    parseExpenseInput,
    findExpenses,
    summarizeExpenses,
    deleteExpenses,
    makeQuery,
    capitalize,
    asCsv,
    writeTempFile,
    deleteFile,
    countExpenses,
    countUsers,
    countCategories,
    getActiveUsers,
    round
}
