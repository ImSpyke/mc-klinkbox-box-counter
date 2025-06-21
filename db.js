const fs = require('fs');

const dbFilePath = './database.json'


function readDatabase() {
    if (!fs.existsSync(dbFilePath)) {
        return {};
    }
    try {
        const data = fs.readFileSync(dbFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return {};
    }
}

let DATABASE_CONTENT = readDatabase()

setInterval(() => {
    DATABASE_CONTENT = readDatabase();
}, 60*1000) // Refresh every minute


const getDB = () => {
    return DATABASE_CONTENT;
}


module.exports = {
    getDB
}