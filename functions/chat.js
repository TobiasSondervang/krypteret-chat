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
            const { action, email, password, message, recipients, folderName, secretKey } = body;

            if (action === 'register') {
                const existingUser = await users.findOne(
                    { email: { $regex: `^${email}$`, $options: 'i' } },
                    { collation: { locale: 'en', strength: 2 } }
                );
                if (existingUser) {
                    console.log('Register failed: User exists', email);
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'User already exists' })
                    };
                }

                await users.insertOne({
                    email: email.toLowerCase(),
                    password
                });
                console.log('User registered:', email);
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
                    console.log('Login failed: Invalid credentials', email);
                    return {
                        statusCode: 401,
                        body: JSON.stringify({ error: 'Invalid credentials' })
                    };
                }
                console.log('User logged in:', email);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, user: { email: user.email } })
                };
            }

            if (['sendMessage', 'createFolder'].includes(action)) {
                const user = await users.findOne(
                    { email: { $regex: `^${email}$`, $options: 'i' } },
                    { collation: { locale: 'en', strength: 2 } }
                );
                if (!user) {
                    console.log(`${action} failed: Unauthorized`, email);
                    return {
                        statusCode: 401,
                        body: JSON.stringify({ error: 'Unauthorized' })
                    };
                }
            }

            if (action === 'sendMessage') {
                if (!secretKey) {
                    console.log('Send message failed: Missing secret key', email);
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
                console.log('Message sent:', email, recipients);
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
                console.log('Folder created:', email, folderName);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: 'Folder created' })
                };
            }
        }

        if (event.httpMethod === 'GET') {
            let action, email;
            try {
                const params = event.queryStringParameters || {};
                action = params.action;
                email = params.email;
                console.log('GET request:', { action, email });
            } catch (error) {
                console.error('Error parsing query parameters:', error);
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid query parameters' })
                };
            }

            if (['getMessages', 'getFolders'].includes(action)) {
                const user = await users.findOne(
                    { email: { $regex: `^${email}$`, $options: 'i' } },
                    { collation: { locale: 'en', strength: 2 } }
                );
                if (!user) {
                    console.log(`${action} failed: Unauthorized`, email);
                    return {
                        statusCode: 401,
                        body: JSON.stringify({ error: 'Unauthorized' })
                    };
                }
            }

            if (action === 'getMessages') {
                const userMessages = await messages.find(
                    { $or: [{ sender: { $regex: `^${email}$`, $options: 'i' } }, { recipients: { $regex: `^${email}$`, $options: 'i' } }] },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                console.log('Messages fetched:', email, userMessages.length);
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
                console.log('Folders fetched:', email, userFolders.length);
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
