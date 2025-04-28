const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

exports.handler = async (event, context) => {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://tobias:2006Tobias@cluster0.jwp1omu.mongodb.net/chatdb?retryWrites=true&w=majority&appName=Cluster0';
  const client = new MongoClient(uri);
  let db;

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db('chatdb');

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      if (body.action === 'register') {
        const { email, password } = body;
        if (!email || !password) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email eller adgangskode' })
          };
        }

        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Bruger eksisterer allerede' })
          };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.collection('users').insertOne({ email, password: hashedPassword });

        return {
          statusCode: 200,
          body: JSON.stringify({ success: true })
        };
      } else if (body.action === 'login') {
        const { email, password } = body;
        if (!email || !password) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email eller adgangskode' })
          };
        }

        const user = await db.collection('users').findOne({ email });
        if (!user) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Bruger ikke fundet' })
          };
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Ugyldig adgangskode' })
          };
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ success: true })
        };
      } else if (body.action === 'createFolder') {
        const { email, folderName } = body;
        if (!email || !folderName) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email eller foldernavn' })
          };
        }

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
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email' })
          };
        }

        const folderDoc = await db.collection('folders').findOne({ email });
        const folders = folderDoc ? folderDoc.folders || [] : [];

        return {
          statusCode: 200,
          body: JSON.stringify(folders)
        };
      } else if (action === 'getMessages') {
        if (!email) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email' })
          };
        }

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
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Manglende email eller foldernavn' })
          };
        }

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
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Ugyldig handling' })
        };
      }
    } else {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Metode ikke tilladt' })
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Serverfejl' })
    };
  } finally {
    await client.close();
    console.log('MongoDB forbindelse lukket');
  }
};