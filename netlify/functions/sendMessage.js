let storage = { users: {}, messages: [], folders: {} }; // Midlertidig hukommelse

exports.handler = async (event) => {
    if (event.httpMethod === "POST") {
        const { sender, recipient, encryptedMessage } = JSON.parse(event.body || "{}");
        if (!sender || !recipient || !encryptedMessage) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Udfyld alle felter" }) };
        }
        const messageId = Date.now().toString();
        storage.messages.push({ id: messageId, sender, recipient, encryptedMessage, timestamp: new Date().toISOString() });
        return { statusCode: 200, body: JSON.stringify({ success: true, message: "Besked sendt" }) };
    } else if (event.httpMethod === "GET") {
        const userEmail = event.headers["x-user-email"];
        if (!userEmail) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger-email mangler" }) };
        }
        const userMessages = storage.messages.filter(msg => msg.recipient === userEmail);
        return { statusCode: 200, body: JSON.stringify({ messages: userMessages }) };
    }

    return { statusCode: 400, body: JSON.stringify({ success: false, message: "Ugyldig metode" }) };
};
