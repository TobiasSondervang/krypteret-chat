const { MongoClient } = require('mongodb');

async function setupIndexes() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
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
