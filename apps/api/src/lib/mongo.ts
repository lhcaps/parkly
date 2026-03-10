import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Mongo connection singleton.
 * - Không connect mỗi request.
 * - Chủ động fail-fast nếu thiếu env.
 */
export async function getMongoDb(): Promise<Db> {
  const url = process.env.MONGO_URL;
  const dbName = process.env.MONGO_DB;
  if (!url) throw new Error('Missing env MONGO_URL');
  if (!dbName) throw new Error('Missing env MONGO_DB');

  if (db) return db;

  client = client ?? new MongoClient(url, {
    maxPoolSize: 10,
    minPoolSize: 0,
  });

  // connect() an toàn để gọi nhiều lần; driver sẽ reuse pool.
  await client.connect();

  db = client.db(dbName);
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
