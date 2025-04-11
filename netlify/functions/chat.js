let storage = { users: {}, messages: [], folders: {} }; // Midlertidig hukommelse

exports.handler = async (event) => {
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};
    const headers = event.headers;

    // Login og brugeroprettelse
    if (method === "POST" && body.action === "signup") {
        const { email, password } = body;
        if (!email || !password) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Email og adgangskode kræves" }) };
        }
        if (storage.users[email]) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger findes allerede" }) };
        }
        storage.users[email] = password;
        return { statusCode: 200, body: JSON.stringify({ success: true, message: "Bruger oprettet" }) };
    }

    if (method === "POST" && body.action === "signin") {
        const { email, password } = body;
        if (!email || !password) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Email og adgangskode kræves" }) };
        }
        if (storage.users[email] && storage.users[email] === password) {
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Logget ind" }) };
        }
        return { statusCode: 401, body: JSON.stringify({ success: false, message: "Forkert email eller adgangskode" }) };
    }

    // Send besked
    if (method === "POST" && body.action === "sendMessage") {
        const { sender, recipient, encryptedMessage } = body;
        if (!sender || !recipient || !encryptedMessage) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Udfyld alle felter" }) };
        }
        const messageId = Date.now().toString();
        storage.messages.push({ id: messageId, sender, recipient, encryptedMessage, timestamp: new Date().toISOString() });
        return { statusCode: 200, body: JSON.stringify({ success: true, message: "Besked sendt" }) };
    }

    // Hent beskeder
    if (method === "GET" && headers["x-action"] === "getMessages") {
        const userEmail = headers["x-user-email"];
        if (!userEmail) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger-email mangler" }) };
        }
        const userMessages = storage.messages.filter(msg => msg.recipient === userEmail);
        return { statusCode: 200, body: JSON.stringify({ success: true, messages: userMessages }) };
    }

    // Opret mappe
    if (method === "POST" && body.action === "createFolder") {
        const { user, folderName } = body;
        if (!user || !folderName) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger og mappenavn kræves" }) };
        }
        if (!storage.folders[user]) {
            storage.folders[user] = [];
        }
        if (!storage.folders[user].find(f => f.name === folderName)) {
            storage.folders[user].push({ name: folderName, messages: [] });
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Mappe oprettet" }) };
        }
        return { statusCode: 400, body: JSON.stringify({ success: false, message: "Mappe findes allerede" }) };
    }

    // Gem besked i mappe
    if (method === "POST" && body.action === "saveToFolder") {
        const { user, folderName, messageId } = body;
        if (!user || !folderName || !messageId) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Alle felter kræves" }) };
        }
        if (!storage.folders[user]) {
            storage.folders[user] = [];
        }
        const folder = storage.folders[user].find(f => f.name === folderName);
        if (folder && !folder.messages.includes(messageId)) {
            folder.messages.push(messageId);
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Besked gemt i mappe" }) };
        }
        return { statusCode: 400, body: JSON.stringify({ success: false, message: "Mappe eller besked findes ikke" }) };
    }

    // Hent mapper
    if (method === "GET" && headers["x-action"] === "getFolders") {
        const user = headers["x-user-email"];
        if (!user) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger-email mangler" }) };
        }
        const folders = storage.folders[user] || [];
        return { statusCode: 200, body: JSON.stringify({ success: true, folders }) };
    }

    return { statusCode: 400, body: JSON.stringify({ success: false, message: "Ugyldig anmodning" }) };
};
