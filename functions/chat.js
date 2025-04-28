const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

exports.handler = async (event, context) => {
  console.log('Function invoked with event:', JSON.stringify(event));

  const uri = process.env.MONGODB_URI || 'mongodb+srv://tobias:2006Tobias@cluster0.jwp1omu.mongodb.net/chatdb?retryWrites=true&w=majority&appName=Cluster0';
  const client = new MongoClient(uri);
  let db;

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db('chatdb');

    if (event.httpMethod === 'POST') {
      if (!event.body) {
        console.error('No request body provided');
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'No request body provided' })
        };
      }

      let body;
      try {
        body = JSON.parse(event.body);
        console.log('Parsed request body:', body);
      } catch (parseError) {
        console.error('Failed to parse request body:', parseError);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid JSON in request body' })
        };
      }

      if (body.action === 'register') {
        const { email, password } = body;
        if (!email || !password) {
          console.error('Missing email or password for register');
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email eller adgangskode' })
          };
        }

        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
          console.log('User already exists:', email);
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Bruger eksisterer allerede' })
          };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Registering new user:', email);
        await db.collection('users').insertOne({ email, password: hashedPassword });

        return {
          statusCode: 200,
          body: JSON.stringify({ success: true })
        };
      } else if (body.action === 'login') {
        const { email, password } = body;
        if (!email || !password) {
          console.error('Missing email or password for login');
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email eller adgangskode' })
          };
        }

        const user = await db.collection('users').findOne({ email });
        if (!user) {
          console.log('User not found:', email);
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Bruger ikke fundet' })
          };
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          console.log('Invalid password for user:', email);
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Ugyldig adgangskode' })
          };
        }

        console.log('Login successful for user:', email);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true })
        };
      } else if (body.action === 'createFolder') {
        const { email, folderName } = body;
        if (!email || !folderName) {
          console.error('Missing email or folderName for createFolder');
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email eller foldernavn' })
          };
        }

        console.log('Creating folder:', folderName, 'for user:', email);
        await db.collection('folders').updateOne(
          { email },
          { $addToSet: { folders: folderName } },
          { upsert: true }
        );

        return {
          statusCode: 200,
          body: JSON.stringify({ success: true })
        };
      } else {
        const { sender, recipient, content } = body;
        if (!sender || !recipient || !content) {
          console.error('Missing sender, recipient, or content for message');
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende afsender, modtager eller indhold' })
          };
        }

        const timestamp = new Date();
        const senderMessage = {
          sender,
          recipient,
          content,
          folder: 'Sent',
          timestamp
        };
        const recipientMessage = {
          sender,
          recipient,
          content,
          folder: 'Received',
          timestamp
        };

        console.log('Saving message from:', sender, 'to:', recipient);
        const session = client.startSession();
        try {
          await session.withTransaction(async () => {
            await db.collection('messages').insertOne(senderMessage, { session });
            await db.collection('messages').insertOne(recipientMessage, { session });
          });
          return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
          };
        } catch (error) {
          console.error('Transaction error:', error);
          return {
            statusCode: error.code === 11000 ? 400 : 500,
            body: JSON.stringify({ error: error.code === 11000 ? 'Duplikat besked ID' : 'Serverfejl' })
          };
        } finally {
          await session.endSession();
        }
      }
    } else if (event.httpMethod === 'GET') {
      const { action, email, folderName } = event.queryStringParameters;

      if (action === 'getFolders') {
        if (!email) {
          console.error('Missing email for getFolders');
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email' })
          };
        }

        console.log('Fetching folders for user:', email);
        const folderDoc = await db.collection('folders').findOne({ email });
        const folders = folderDoc ? folderDoc.folders || [] : [];

        return {
          statusCode: 200,
          body: JSON.stringify(folders)
        };
      } else if (action === 'getMessages') {
        if (!email) {
          console.error('Missing email for getMessages');
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email' })
          };
        }

        console.log('Fetching messages for user:', email);
        const messages = await db.collection('messages').find({
          $or: [
            { sender: email, folder: 'Sent' },
            { recipient: email, folder: 'Received' }
          ]
        }).toArray();

        return {
          statusCode: 200,
          body: JSON.stringify(messages)
        };
      } else if (action === 'getFolderMessages') {
        if (!email || !folderName) {
          console.error('Missing email or folderName for getFolderMessages');
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email eller foldernavn' })
          };
        }

        console.log('Fetching messages for folder:', folderName, 'and user:', email);
        const messages = await db.collection('messages').find({
          $or: [
            { sender: email, folder: folderName },
            { recipient: email, folder: folderName }
          ]
        }).toArray();

        return {
          statusCode: 200,
          body: JSON.stringify(messages)
        };
      } else {
        console.error('Invalid action for GET request:', action);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Ugyldig handling' })
        };
      }
    } else {
      console.error('Method not allowed:', event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Metode ikke tilladt' })
      };
    }
  } catch (error) {
    console.error('Server error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Serverfejl: ' + error.message })
    };
  } finally {
    try {
      await client.close();
      console.log('MongoDB forbindelse lukket');
    } catch (closeError) {
      console.error('Error closing MongoDB connection:', closeError);
    }
  }
};