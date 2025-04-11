const fs = require('fs').promises;
const path = require('path');

const STORAGE_PATH = path.join(__dirname, '../data/storage.json');

exports.handler = async (event) => {
    let storage = { users: {}, messages: [], folders: {} };
    try {
        const data = await fs.readFile(STORAGE_PATH, 'utf8');
        storage = JSON.parse(data);
    } catch (error) {
        // Filen findes ikke endnu
    }

    if (event.httpMethod === "POST") {
        const { user, folderName, messageId, action } = JSON.parse(event.body);

        if (!storage.folders[user]) {
            storage.folders[user] = [];
        }

        if (action === "create") {
            if (!storage.folders[user].find(f => f.name === folderName)) {
                storage.folders[user].push({ name: folderName, messages: [] });
                await fs.writeFile(STORAGE_PATH, JSON.stringify(storage, null, 2));
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Mappe findes allerede" }) };
        } else if (action === "save") {
            const folder = storage.folders[user].find(f => f.name === folderName);
            if (folder && !folder.messages.includes(messageId)) {
                folder.messages.push(messageId);
                await fs.writeFile(STORAGE_PATH, JSON.stringify(storage, null, 2));
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Mappe eller besked findes ikke" }) };
        }
    } else if (event.httpMethod === "GET") {
        const user = event.headers["x-user-email"];
        const folders = storage.folders[user] || [];
        return { statusCode: 200, body: JSON.stringify({ folders }) };
    }

    return { statusCode: 400, body: JSON.stringify({ message: "Ugyldig metode" }) };
};