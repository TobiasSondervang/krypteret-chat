const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();

app.use(express.json());

const uri = process.env.MONGODB_URI || 'mongodb+srv://tobias:2006Tobias@cluster0.jwp1omu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);
let db;

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db('chatdb');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

connectToMongoDB();

// POST: Send en besked
app.post('/chat', async (req, res) => {
  try {
    const { sender, recipient, content } = req.body;
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
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Transaction error:', error);
      if (error.code === 11000) {
        res.status(400).json({ error: 'Duplikat besked ID' });
      } else {
        res.status(500).json({ error: 'Serverfejl' });
      }
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Serverfejl' });
  }
});

// GET: Hent beskeder fra en mappe
app.get('/chat', async (req, res) => {
  try {
    const { action, email, folderName } = req.query;
    if (action !== 'getFolderMessages') {
      return res.status(400).json({ error: 'Ugyldig handling' });
    }

    const messages = await db.collection('messages').find({
      $or: [
        { sender: email, folder: folderName },
        { recipient: email, folder: folderName }
      ]
    }).toArray();

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Serverfejl' });
  }
});

// Luk MongoDB forbindelse ved serverstop
process.on('SIGTERM', async () => {
  await client.close();
  console.log('MongoDB forbindelse lukket');
  process.exit(0);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server kører på port ${port}`);
});
