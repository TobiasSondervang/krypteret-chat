const fs = require('fs').promises;
const path = require('path');

const STORAGE_PATH = path.join(__dirname, '../data/storage.json');

exports.handler = async (event) => {
    const { email, password, action } = JSON.parse(event.body || "{}");

    let storage = { users: {}, messages: [], folders: {} };
    try {
        const data = await fs.readFile(STORAGE_PATH, 'utf8');
        storage = JSON.parse(data);
    } catch (error) {
        // Filen findes ikke endnu
    }

    if (action === "signup") {
        if (storage.users[email]) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger findes allerede" }) };
        }
        storage.users[email] = password;
        try {
            await fs.writeFile(STORAGE_PATH, JSON.stringify(storage, null, 2));
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ success: false, message: "Kunne ikke gemme bruger" }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } else if (action === "signin") {
        if (storage.users[email] && storage.users[email] === password) {
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
        return { statusCode: 401, body: JSON.stringify({ success: false, message: "Forkert email eller adgangskode" }) };
    }

    return { statusCode: 400, body: JSON.stringify({ success: false, message: "Ugyldig anmodning" }) };
};
