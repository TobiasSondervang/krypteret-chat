```javascript
     const { MongoClient } = require('mongodb');

     exports.handler = async (event, context) => {
         console.log('Function invoked:', { method: event.httpMethod, headers: event.headers, body: event.body });

         const uri = process.env.MONGODB_URI;
         if (!uri) {
             console.error('MONGODB_URI is not set');
             return {
                 statusCode: 500,
                 body: JSON.stringify({ success: false, message: 'Server configuration error: MONGODB_URI missing' })
             };
         }

         const client = new MongoClient(uri);
         try {
             console.log('Attempting to connect to MongoDB');
             await client.connect();
             console.log('Connected to MongoDB');
             const db = client.db('chatdb');
             const users = db.collection('users');
             const messages = db.collection('messages');

             if (event.httpMethod === 'POST') {
                 let body;
                 try {
                     body = JSON.parse(event.body || '{}');
                 } catch (e) {
                     console.error('Failed to parse body:', e.message);
                     return {
                         statusCode: 400,
                         body: JSON.stringify({ success: false, message: 'Invalid request body' })
                     };
                 }
                 const { action, email, password, sender, recipients, encryptedMessage } = body;
                 console.log('Parsed body:', { action, email, sender, recipients });

                 if (action === 'signup') {
                     const existingUser = await users.findOne({ email });
                     if (existingUser) {
                         console.log('User already exists:', email);
                         return {
                             statusCode: 400,
                             body: JSON.stringify({ success: false, message: 'Bruger findes allerede' })
                         };
                     }
                     await users.insertOne({ email, password });
                     console.log('User created:', email);
                     return {
                         statusCode: 200,
                         body: JSON.stringify({ success: true, message: 'Bruger oprettet' })
                     };
                 }

                 if (action === 'signin') {
                     const user = await users.findOne({ email, password });
                     if (!user) {
                         console.log('Invalid credentials:', email);
                         return {
                             statusCode: 400,
                             body: JSON.stringify({ success: false, message: 'Forkert email eller adgangskode' })
                         };
                     }
                     console.log('User signed in:', email);
                     return {
                         statusCode: 200,
                         body: JSON.stringify({ success: true, message: 'Logget ind' })
                     };
                 }

                 if (action === 'sendMessage') {
                     const message = {
                         sender,
                         recipients: recipients.split(',').map(r => r.trim()),
                         encryptedMessage,
                         timestamp: new Date()
                     };
                     await messages.insertOne(message);
                     console.log('Message sent:', { sender, recipients });
                     return {
                         statusCode: 200,
                         body: JSON.stringify({ success: true, message: 'Besked sendt' })
                     };
                 }
             }

             if (event.httpMethod === 'GET' && event.headers['x-action'] === 'getMessages') {
                 const userEmail = event.headers['x-user-email'];
                 const userMessages = await messages.find({
                     $or: [
                         { sender: userEmail },
                         { recipients: userEmail }
                     ]
                 }).toArray();
                 console.log('Messages fetched for:', userEmail);
                 return {
                     statusCode: 200,
                     body: JSON.stringify({ success: true, messages: userMessages })
                 };
             }

             console.log('Invalid request');
             return {
                 statusCode: 400,
                 body: JSON.stringify({ success: false, message: 'Ugyldig anmodning' })
             };
         } catch (error) {
             console.error('Function error:', error.message, error.stack);
             return {
                 statusCode: 500,
                 body: JSON.stringify({ success: false, message: `Server error: ${error.message}` })
             };
         } finally {
             try {
                 await client.close();
                 console.log('MongoDB connection closed');
             } catch (e) {
                 console.error('Error closing MongoDB connection:', e.message);
             }
         }
     };
     ```
