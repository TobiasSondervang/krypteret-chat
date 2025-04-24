const { MongoClient } = require('mongodb');
const crypto = require('crypto');

exports.handler = async (event, context) => {
    console.log('Function invoked:', event);
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error('MONGODB_URI is not set');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'MONGODB_URI is not set' })
        };
    }

    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();
        const db = client.db('chatdb');
        const users = db.collection('users');
        const messages = db.collection('messages');
        const folders = db.collection('folders');

        const encryptMessage = (text, secretKey) => {
            const cipher = crypto.createCipher('aes-256-cbc', secretKey);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return encrypted;
        };

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { action, email, username, password, message, recipients, folderName, secretKey } = body;

            if (action === 'register') {
                const existingUser = await users.findOne(
                    { $or: [{ email: { $regex: `^${email}$`, $options: 'i' } }, { username: { $regex: `^${username}$`, $options: 'i' } }] },
                    { collation: { locale: 'en', strength: 2 } }
                );
                if (existingUser) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'User already exists' })
                    };
                }

                await users.insertOne({
                    email: email.toLowerCase(),
                    username: username.toLowerCase(),
                    password
                });
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: 'User registered' })
                };
            }

            if (action === 'login') {
                const user = await users.findOne(
                    { email: { $regex: `^${email}$`, $options: 'i' } },
                    { collation: { locale: 'en', strength: 2 } }
                );
                if (!user || user.password !== password) {
                    return {
                        statusCode: 401,
                        body: JSON.stringify({ error: 'Invalid credentials' })
                    };
                }
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, user: { email: user.email, username: user.username } })
                };
            }

            if (action === 'sendMessage') {
                if (!secretKey) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'Secret key is required' })
                    };
                }
                const encryptedMessage = encryptMessage(message, secretKey);
                await messages.insertOne({
                    sender: email.toLowerCase(),
                    recipients: recipients.map(r => r.toLowerCase()),
                    content: encryptedMessage,
                    timestamp: new Date()
                });
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: 'Message sent' })
                };
            }

            if (action === 'createFolder') {
                await folders.insertOne({
                    userEmail: email.toLowerCase(),
                    folderName
                });
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: 'Folder created' })
                };
            }
        }

        if (event.httpMethod === 'GET') {
            const { action, email } = JSON.parse(event.queryStringParameters || '{}');

            if (action === 'getMessages') {
                const userMessages = await messages.find(
                    { $or: [{ sender: { $regex: `^${email}$`, $options: 'i' } }, { recipients: { $regex: `^${email}$`, $options: 'i' } }] },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, messages: userMessages })
                };
            }

            if (action === 'getFolders') {
                const userFolders = await folders.find(
                    { userEmail: { $regex: `^${email}$`, $options: 'i' } },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, folders: userFolders })
                };
            }
        }

        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Function error' })
        };
    } finally {
        if (client) await client.close();
    }
};
