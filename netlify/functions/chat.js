const { MongoClient } = require('mongodb');

exports.handler = async (event, context) => {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('chatdb');
        const users = db.collection('users');
        const messages = db.collection('messages');

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { action, email, password, sender, recipients, encryptedMessage } = body;

            if (action === 'signup') {
                const existingUser = await users.findOne({ email });
                if (existingUser) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ success: false, message: 'Email allerede i brug' })
                    };
                }
                await users.insertOne({ email, password });
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: 'Bruger oprettet' })
                };
            }

            if (action === 'signin') {
                const user = await users.findOne({ email, password });
                if (!user) {
                    return {
                        statusCode: 401,
                        body: JSON.stringify({ success: false, message: 'Forkert email eller adgangskode' })
                    };
                }
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: 'Logget ind' })
                };
            }

            if (action === 'sendMessage') {
                const recipientList = recipients.split(',').map(r => r.trim());
                const message = {
                    sender,
                    recipients: recipientList,
                    encryptedMessage,
                    timestamp: new Date()
                };
                await messages.insertOne(message);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: 'Besked sendt' })
                };
            }
        }

        if (event.httpMethod === 'GET') {
            const action = event.headers['x-action'];
            const userEmail = event.headers['x-user-email'];

            if (action === 'getMessages') {
                const userMessages = await messages.find({
                    $or: [
                        { sender: userEmail },
                        { recipients: userEmail }
                    ]
                }).toArray();
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, messages: userMessages })
                };
            }
        }

        return {
            statusCode: 400,
            body: JSON.stringify({ success: false, message: 'Ugyldig anmodning' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: error.message })
        };
    } finally {
        await client.close();
    }
};
