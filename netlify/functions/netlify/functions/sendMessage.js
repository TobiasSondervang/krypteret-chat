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
        const { sender, recipient, encryptedMessage } = JSON.parse(event.body);
        const messageId = Date.now().toString();
        storage.messages.push({ id: messageId, sender, recipient, encryptedMessage, timestamp: new Date().toISOString() });
        await fs.writeFile(STORAGE_PATH, JSON.stringify(storage, null, 2));
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } else if (event.httpMethod === "GET") {
        const userEmail = event.headers["x-user-email"];
        const userMessages = storage.messages.filter(msg => msg.recipient === userEmail);
        return { statusCode: 200, body: JSON.stringify({ messages: userMessages }) };
    }

    return { statusCode: 400, body: JSON.stringify({ message: "Ugyldig metode" }) };
};