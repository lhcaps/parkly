import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();

async function testMongo() {
  const client = new MongoClient(process.env.MONGO_URL || '');
  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB);
    const collection = db.collection('device_events');
    
    // Thử insert một log giả lập từ thiết bị quẹt thẻ
    const result = await collection.insertOne({
      event_type: 'CARD_SWIPE_IN',
      device_id: 'GATE_01',
      payload: { card_id: 'RFID_123456', plate: '51A-999.99' },
      timestamp: new Date()
    });
    
    console.log('✅ MongoDB OK! Đã bắn log ID:', result.insertedId);
  } finally {
    await client.close();
  }
}
testMongo();