const { MongoClient } = require('mongodb');

  exports.handler = async (event, context) => {
    const uri = process.env.MONGODB_URI || 'mongodb+srv://tobias:2006Tobias@cluster0.jwp1omu.mongodb.net/chatdb?retryWrites=true&w=majority&appName=Cluster0';
    const client = new MongoClient(uri);
    let db;

    try {
      await client.connect();
      console.log('Connected to MongoDB');
      db = client.db('chatdb');

      if (event.httpMethod === 'POST') {
        const { sender, recipient, content } = JSON.parse(event.body);
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
      } else if (event.httpMethod === 'GET') {
        const { action, email, folderName } = event.queryStringParameters;
        if (action !== 'getFolderMessages') {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Ugyldig handling' })
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
