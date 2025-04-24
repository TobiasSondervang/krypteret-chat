const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');

exports.handler = async (event, context) => {
    console.log('Function invoked:', JSON.stringify(event, null, 2));
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
        console.log('Connected to MongoDB');
        const db = client.db('chatdb');
        const users = db.collection('users');
        const messages = db.collection('messages');
        const folders = db.collection('folders');

        const encryptMessage = (text, secretKey) => {
            try {
                const cipher = crypto.createCipher('aes-256-cbc', secretKey);
                let encrypted = cipher.update(text, 'utf8', 'hex');
                encrypted += cipher.final('hex');
                return encrypted;
            } catch (error) {
                console.error('Encryption error:', error);
                throw new Error('Failed to encrypt message');
            }
        };

        if (event.httpMethod === 'POST') {
            let body;
            try {
                body = JSON.parse(event.body);
            } catch (error) {
                console.error('Invalid JSON body:', error);
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid JSON body' })
                };
            }
            const { action, email, password, message, recipients, folderName, secretKey, messageId, newFolder } = body;

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
                await folders.insertMany([
                    { userEmail: email.toLowerCase(), folderName: 'Sent' },
                    { userEmail: email.toLowerCase(), folderName: 'Received' }
                ]);
                console.log('User registered with folders:', email);
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

            if (['sendMessage', 'createFolder', 'moveMessage', 'deleteMessage'].includes(action)) {
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
                if (!message || !recipients || !Array.isArray(recipients)) {
                    console.log('Send message failed: Invalid message or recipients', { message, recipients });
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'Message and recipients are required' })
                    };
                }
                const encryptedMessage = encryptMessage(message, secretKey);
                const messageDoc = {
                    sender: email.toLowerCase(),
                    recipients: recipients.map(r => r.toLowerCase()),
                    content: encryptedMessage,
                    timestamp: new Date(),
                    folder: 'Sent'
                };
                await messages.insertOne(messageDoc);
                for (const recipient of recipients) {
                    await messages.insertOne({
                        ...messageDoc,
                        sender: email.toLowerCase(),
                        recipients: [recipient.toLowerCase()],
                        folder: 'Received'
                    });
                }
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

            if (action === 'moveMessage') {
                const result = await messages.updateOne(
                    { _id: new ObjectId(messageId), sender: { $regex: `^${email}$`, $options: 'i' } },
                    { $set: { folder: newFolder } }
                );
                if (result.modifiedCount === 0) {
                    console.log('Move message failed: Message not found or unauthorized', messageId, email);
                    return {
                        statusCode: 404,
                        body: JSON.stringify({ error: 'Message not found or unauthorized' })
                    };
                }
                console.log('Message moved:', messageId, newFolder);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: 'Message moved' })
                };
            }

            if (action === 'deleteMessage') {
                const result = await messages.deleteOne(
                    { _id: new ObjectId(messageId), sender: { $regex: `^${email}$`, $options: 'i' } }
                );
                if (result.deletedCount === 0) {
                    console.log('Delete message failed: Message not found or unauthorized', messageId, email);
                    return {
                        statusCode: 404,
                        body: JSON.stringify({ error: 'Message not found or unauthorized' })
                    };
                }
                console.log('Message deleted:', messageId);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, message: 'Message deleted' })
                };
            }
        }

        if (event.httpMethod === 'GET') {
            let action, email, folderName;
            try {
                const params = event.queryStringParameters || {};
                action = params.action;
                email = params.email;
                folderName = params.folderName;
                console.log('GET request:', { action, email, folderName });
            } catch (error) {
                console.error('Error parsing query parameters:', error);
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid query parameters' })
                };
            }

            if (['getMessages', 'getFolders', 'getFolderMessages'].includes(action)) {
                const user = await users.findOne(
                    { email: { $regex: `^${email}$`, $options: 'i' } },
                    { collation: { locale: 'en', strength: 2 } }
                );
                if (!user) {
                    console.log(`${action} forespørgsel mislykkedes: Uautoriseret`, email);
                    return {
                        statusCode: 401,
                        body: JSON.stringify({ error: 'Uautoriseret' })
                    };
                }
            }

            if (action === 'getMessages') {
                const userMessages = await messages.find(
                    { 
                        $or: [
                            { sender: { $regex: `^${email}$`, $options: 'i' } }, 
                            { recipients: { $regex: `^${email}$`, $options: 'i' } }
                        ], 
                        content: { $exists: true } 
                    },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                const folders = await folders.find(
                    { userEmail: { $regex: `^${email}$`, $options: 'i' } },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                console.log('Beskeder hentet:', email, userMessages.length);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, messages: userMessages, folders })
                };
            }

            if (action === 'getFolders') {
                const userFolders = await folders.find(
                    { userEmail: { $regex: `^${email}$`, $options: 'i' } },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                console.log('Mapper hentet:', email, userFolders.length);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, folders: userFolders })
                };
            }

            if (action === 'getFolderMessages') {
                const userMessages = await messages.find(
                    { 
                        $or: [
                            { sender: { $regex: `^${email}$`, $options: 'i' } }, 
                            { recipients: { $regex: `^${email}$`, $options: 'i' } }
                        ],
                        folder: folderName,
                        content: { $exists: true }
                    },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                const folders = await folders.find(
                    { userEmail: { $regex: `^${email}$`, $options: 'i' } },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                console.log('Mapper beskeder hentet:', email, folderName, userMessages.length);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, messages: userMessages, folders })
                };
            }
        }

        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Metode ikke tilladt' })
        };
    } catch (error) {
        console.error('Funktionsfejl:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Funktionsfejl', details: error.message })
        };
    } finally {
        if (client) {
            await client.close();
            console.log('MongoDB forbindelse lukket');
        }
    }
};
