const { MongoClient } = require('mongodb');

// Valideringshjælpere
const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    return passwordRegex.test(password);
};

// MongoDB klient
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

exports.handler = async (event) => {
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};
    const headers = event.headers;

    try {
        await client.connect();
        const db = client.db('chatdb');
        const users = db.collection('users');
        const messages = db.collection('messages');
        const folders = db.collection('folders');

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

            // Tjek om bruger findes
            const existingUser = await users.findOne({ email });
            if (existingUser) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger findes allerede" }) };
            }

            // Opret bruger
            await users.insertOne({ email, password }); // Bemærk: I produktion bør password hashes!
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

            // Hent bruger
            const user = await users.findOne({ email });
            if (user && user.password === password) {
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
            const timestamp = new Date().toISOString();
            for (const recipient of recipientList) {
                await messages.insertOne({
                    id: messageId + recipient,
                    sender,
                    recipient,
                    encryptedMessage,
                    timestamp
                });
            }
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Besked sendt" }) };
        }

        // Hent beskeder
        if (method === "GET" && headers["x-action"] === "getMessages") {
            const userEmail = headers["x-user-email"];
            if (!userEmail) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger-email mangler" }) };
            }
            const userMessages = await messages.find({ recipient: userEmail }).toArray();
            return { statusCode: 200, body: JSON.stringify({ success: true, messages: userMessages }) };
        }

        // Opret mappe
        if (method === "POST" && body.action === "createFolder") {
            const { user, folderName } = body;
            if (!user || !folderName) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger og mappenavn kræves" }) };
            }

            // Tjek om mappe findes
            const existingFolder = await folders.findOne({ user, name: folderName });
            if (existingFolder) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Mappe findes allerede" Politiken skriver også om:Mappe findes allerede" }) };
            }

            // Opret mappe
            await folders.insertOne({ user, name: folderName, messages: [] });
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Mappe oprettet" }) };
        }

        // Gem besked i mappe
        if (method === "POST" && body.action === "saveToFolder") {
            const { user, folderName, messageId } = body;
            if (!user || !folderName || !messageId) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Alle felter kræves" }) };
            }

            const folder = await folders.findOne({ user, name: folderName });
            if (!folder) {
                await folders.insertOne({ user, name: folderName, messages: [messageId] });
                return { statusCode: 200, body: JSON.stringify({ success: true, message: "Mappe oprettet og besked gemt" }) };
            }

            if (!folder.messages.includes(messageId)) {
                await folders.updateOne(
                    { user, name: folderName },
                    { $push: { messages: messageId } }
                );
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
            const userFolders = await folders.find({ user }).toArray();
            return { statusCode: 200, body: JSON.stringify({ success: true, folders: userFolders }) };
        }

        // Hent beskeder fra en mappe
        if (method === "GET" && headers["x-action"] === "getFolderMessages") {
            const user = headers["x-user-email"];
            const folderName = headers["x-folder-name"];
            if (!user || !folderName) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger eller mappenavn mangler" }) };
            }
            const folder = await folders.findOne({ user, name: folderName });
            if (!folder) {
                return { statusCode: 404, body: JSON.stringify({ success: false, message: "Mappe findes ikke" }) };
            }
            const folderMessages = await messages.find({ id: { $in: folder.messages } }).toArray();
            return { statusCode: 200, body: JSON.stringify({ success: true, messages: folderMessages }) };
        }

        // Slet besked
        if (method === "POST" && body.action === "deleteMessage") {
            const { user, messageId } = body;
            if (!user || !messageId) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger og besked-ID kræves" }) };
            }
            const message = await messages.findOne({ id: messageId, recipient: user });
            if (!message) {
                return { statusCode: 404, body: JSON.stringify({ success: false, message: "Besked findes ikke" }) };
            }
            await messages.deleteOne({ id: messageId });

            // Fjern fra mapper
            await folders.updateMany(
                { user, messages: messageId },
                { $pull: { messages: messageId } }
            );
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Besked slettet" }) };
        }

        return { statusCode: 400, body: JSON.stringify({ success: false, message: "Ugyldig anmodning" }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ success: false, message: "Serverfejl: " + error.message }) };
    } finally {
        await client.close();
    }
};
