let storage = { users: {}, messages: [], folders: {} }; // Midlertidig hukommelse

// Valideringshjælpere
const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    return passwordRegex.test(password);
};

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
        if (!validateEmail(email)) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Ugyldig email - skal indeholde @, bogstaver og et punktum" }) };
        }
        if (!validatePassword(password)) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Adgangskode skal være mindst 8 tegn og indeholde store bogstaver, små bogstaver og tal" }) };
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
        if (!validateEmail(email)) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Ugyldig email - skal indeholde @, bogstaver og et punktum" }) };
        }
        if (storage.users[email] && storage.users[email] === password) {
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Logget ind" }) };
        }
        return { statusCode: 401, body: JSON.stringify({ success: false, message: "Forkert email eller adgangskode" }) };
    }

    // Send besked (understøtter flere modtagere)
    if (method === "POST" && body.action === "sendMessage") {
        const { sender, recipients, encryptedMessage } = body;
        if (!sender || !recipients || !encryptedMessage) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Udfyld alle felter" }) };
        }
        const recipientList = Array.isArray(recipients) ? recipients : recipients.split(',').map(r => r.trim());
        const messageId = Date.now().toString();
        recipientList.forEach(recipient => {
            storage.messages.push({ id: messageId + recipient, sender, recipient, encryptedMessage, timestamp: new Date().toISOString() });
        });
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
        if (!folder) {
            storage.folders[user].push({ name: folderName, messages: [messageId] });
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Mappe oprettet og besked gemt" }) };
        }
        if (!folder.messages.includes(messageId)) {
            folder.messages.push(messageId);
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Besked gemt i mappe" }) };
        }
        return { statusCode: 400, body: JSON.stringify({ success: false, message: "Besked er allerede i mappen" }) };
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

    // Hent beskeder fra en mappe
    if (method === "GET" && headers["x-action"] === "getFolderMessages") {
        const user = headers["x-user-email"];
        const folderName = headers["x-folder-name"];
        if (!user || !folderName) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger eller mappenavn mangler" }) };
        }
        const folder = storage.folders[user]?.find(f => f.name === folderName);
        if (!folder) {
            return { statusCode: 404, body: JSON.stringify({ success: false, message: "Mappe findes ikke" }) };
        }
        const folderMessages = storage.messages.filter(msg => folder.messages.includes(msg.id));
        return { statusCode: 200, body: JSON.stringify({ success: true, messages: folderMessages }) };
    }

    // Slet besked
    if (method === "POST" && body.action === "deleteMessage") {
        const { user, messageId } = body;
        if (!user || !messageId) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger og besked-ID kræves" }) };
        }
        const messageIndex = storage.messages.findIndex(msg => msg.id === messageId && msg.recipient === user);
        if (messageIndex === -1) {
            return { statusCode: 404, body: JSON.stringify({ success: false, message: "Besked findes ikke" }) };
        }
        storage.messages.splice(messageIndex, 1);
        if (storage.folders[user]) {
            storage.folders[user].forEach(folder => {
                const msgIndex = folder.messages.indexOf(messageId);
                if (msgIndex !== -1) folder.messages.splice(msgIndex, 1);
            });
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, message: "Besked slettet" }) };
    }

    return { statusCode: 400, body: JSON.stringify({ success: false, message: "Ugyldig anmodning" }) };
};
