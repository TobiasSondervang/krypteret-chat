let storage = { users: {}, messages: [], folders: {} }; // Midlertidig hukommelse

exports.handler = async (event) => {
    if (event.httpMethod === "POST") {
        const { user, folderName, messageId, action } = JSON.parse(event.body || "{}");

        if (!user) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger mangler" }) };
        }

        if (!storage.folders[user]) {
            storage.folders[user] = [];
        }

        if (action === "create") {
            if (!folderName) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Mappenavn mangler" }) };
            }
            if (!storage.folders[user].find(f => f.name === folderName)) {
                storage.folders[user].push({ name: folderName, messages: [] });
                return { statusCode: 200, body: JSON.stringify({ success: true, message: "Mappe oprettet" }) };
            }
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Mappe findes allerede" }) };
        } else if (action === "save") {
            if (!folderName || !messageId) {
                return { statusCode: 400, body: JSON.stringify({ success: false, message: "Mappe eller besked-ID mangler" }) };
            }
            const folder = storage.folders[user].find(f => f.name === folderName);
            if (folder && !folder.messages.includes(messageId)) {
                folder.messages.push(messageId);
                return { statusCode: 200, body: JSON.stringify({ success: true, message: "Besked gemt i mappe" }) };
            }
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Mappe eller besked findes ikke" }) };
        }
    } else if (event.httpMethod === "GET") {
        const user = event.headers["x-user-email"];
        if (!user) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger-email mangler" }) };
        }
        const folders = storage.folders[user] || [];
        return { statusCode: 200, body: JSON.stringify({ folders }) };
    }

    return { statusCode: 400, body: JSON.stringify({ success: false, message: "Ugyldig metode" }) };
};
