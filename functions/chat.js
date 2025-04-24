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
                    { _id: new MongoClient.ObjectId(messageId), sender: { $regex: `^${email}$`, $options: 'i' } },
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
                    { _id: new MongoClient.ObjectId(messageId), sender: { $regex: `^${email}$`, $options: 'i' } }
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
                    console.log(`${action} failed: Unauthorized`, email);
                    return {
                        statusCode: 401,
                        body: JSON.stringify({ error: 'Unauthorized' })
                    };
                }
            }

            if (action === 'getMessages') {
                const userMessages = await messages.find(
                    { $or: [{ sender: { $regex: `^${email}$`, $options: 'i' } }, { recipients: { $regex: `^${email}$`, $options: 'i' } }], content: { $exists: true } },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                const folders = await folders.find(
                    { userEmail: { $regex: `^${email}$`, $options: 'i' } },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                console.log('Messages fetched:', email, userMessages.length);
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
                console.log('Folders fetched:', email, userFolders.length);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, folders: userFolders })
                };
            }

            if (action === 'getFolderMessages') {
                const userMessages = await messages.find(
                    { 
                        $or: [{ sender: { $regex: `^${email}$`, $options: 'i' } }, { recipients: { $regex: `^${email}$`, $options: 'i' } }],
                        folder: folderName,
                        content: { $exists: true }
                    },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                const folders = await folders.find(
                    { userEmail: { $regex: `^${email}$`, $options: 'i' } },
                    { collation: { locale: 'en', strength: 2 } }
                ).toArray();
                console.log('Folder messages fetched:', email, folderName, userMessages.length);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ success: true, messages: userMessages, folders })
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
