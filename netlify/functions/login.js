let storage = { users: {}, messages: [], folders: {} }; // Midlertidig hukommelse

exports.handler = async (event) => {
    const { email, password, action } = JSON.parse(event.body || "{}");

    if (!email || !password) {
        return { statusCode: 400, body: JSON.stringify({ success: false, message: "Email og adgangskode kræves" }) };
    }

    if (action === "signup") {
        if (storage.users[email]) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: "Bruger findes allerede" }) };
        }
        storage.users[email] = password; // Gemmer i hukommelse
        return { statusCode: 200, body: JSON.stringify({ success: true, message: "Bruger oprettet" }) };
    } else if (action === "signin") {
        if (storage.users[email] && storage.users[email] === password) {
            return { statusCode: 200, body: JSON.stringify({ success: true, message: "Logget ind" }) };
        }
        return { statusCode: 401, body: JSON.stringify({ success: false, message: "Forkert email eller adgangskode" }) };
    }

    return { statusCode: 400, body: JSON.stringify({ success: false, message: "Ugyldig anmodning" }) };
};
