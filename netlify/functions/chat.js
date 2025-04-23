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

        // Opret bruger
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

        // Log ind
        if (method === "POST" && body.action === "signin") {
            const { email, password } = body;
            if (!email || !password) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Email og adgangskode kræves" }) };
            }

            // Tjek bruger
            const user = await users.findOne({ email, password });
            if (!user) {
                return { statusCode: 401, body: JSON.stringify({ success: false, message: "Forkert email eller adgangskode" }) };
            }

            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Logget ind" }) };
        }

        // Send besked
        if (method === "POST" && body.action === "sendMessage") {
            const { sender, recipients, encryptedMessage } = body;
            if (!sender || !recipients || !encryptedMessage) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Afsender, modtagere og besked kræves" }) };
            }

            const recipientArray = recipients.split(',').map(email => email.trim());
            const messageId = Date.now().toString(); // Simpel ID, brug UUID i produktion
            const timestamp = new Date().toISOString();

            // Gem besked for hver modtager
            const messageDocs = recipientArray.map(recipient => ({
                id: messageId,
                sender,
                recipient,
                encryptedMessage,
                timestamp
            }));

            await messages.insertMany(messageDocs);
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Besked sendt" }) };
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
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Mappe findes allerede" }) };
            }

            // Opret mappe
            await folders.insertOne({ user, name: folderName, messages: [] });
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Mappe oprettet" }) };
        }

        // Hent mapper
        if (method === "GET" && headers['x-action'] === "getFolders") {
            const user = headers['x-user-email'];
            if (!user) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger kræves" }) };
            }

            const userFolders = await folders.find({ user }).toArray();
            return { statusCode: 200, body: JSON.stringify({ success: true, folders: userFolders }) };
        }

        // Hent beskeder fra en mappe
        if (method === "GET" && headers['x-action'] === "getFolderMessages") {
            const user = headers['x-user-email'];
            const folderName = headers['x-folder-name'];
            if (!user || !folderName) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger og mappenavn kræves" }) };
            }

            const folder = await folders.findOne({ user, name: folderName });
            if (!folder) {
                return { statusCode: 404, body: JSON.stringify({ success: false, message: "Mappe ikke fundet" }) };
            }

            const messageIds = folder.messages || [];
            const folderMessages = await messages.find({ id: { $in: messageIds }, recipient: user }).toArray();
            return { statusCode: 200, body: JSON.stringify({ success: true, messages: folderMessages }) };
        }

        // Gem besked i mappe
        if (method === "POST" && body.action === "saveToFolder") {
            const { user, folderName, messageId } = body;
            if (!user || !folderName || !messageId) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger, mappenavn og besked-ID kræves" }) };
            }

            const folder = await folders.findOne({ user, name: folderName });
            if (!folder) {
                return { statusCode: 404, body: JSON.stringify({ success: false, message: "Mappe ikke fundet" }) };
            }

            // Tjek om besked findes
            const message = await messages.findOne({ id: messageId, recipient: user });
            if (!message) {
                return { statusCode: 404, body: JSON.stringify({ success: false, message: "Besked ikke fundet" }) };
            }

            // Tilføj besked til mappe
            await folders.updateOne(
                { user, name: folderName },
                { $addToSet: { messages: messageId } }
            );

            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Besked gemt i mappe" }) };
        }

        // Slet besked
        if (method === "POST" && body.action === "deleteMessage") {
            const { user, messageId } = body;
            if (!user || !messageId) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger og besked-ID kræves" }) };
            }

            // Slet besked
            const result = await messages.deleteOne({ id: messageId, recipient: user });
            if (result.deletedCount === 0) {
                return { statusCode: 404, body: JSON.stringify({ success: false, message: "Besked ikke fundet" }) };
            }

            // Fjern besked fra alle mapper
            await folders.updateMany(
                { user, messages: messageId },
                { $pull: { messages: messageId } }
            );

            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Besked slettet" }) };
        }

        // Hvis ingen handling matchede
        return { statusCode: 400, body: JSON.stringify({ success: false, message: "Ugyldig handling" }) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ success: false, message: "Serverfejl: " + error.message }) };
    } finally {
        await client.close();
    }
};
