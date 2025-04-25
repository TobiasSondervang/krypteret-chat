const { MongoClient } = require('mongodb');

  async function setupIndexes() {
    const uri = 'mongodb+srv://tobias:2006Tobias@cluster0.jwp1omu.mongodb.net/chatdb?retryWrites=true&w=majority&appName=Cluster0';
    const client = new MongoClient(uri);

    try {
      await client.connect();
      console.log('Connected to MongoDB');
      const db = client.db('chatdb');
      await db.collection('messages').createIndex({ sender: 1, folder: 1 });
      await db.collection('messages').createIndex({ recipient: 1, folder: 1 });
      console.log('Indekser oprettet succesfuldt');
    } catch (error) {
      console.error('Fejl ved oprettelse af indekser:', error);
    } finally {
      await client.close();
    }
  }

  setupIndexes();
