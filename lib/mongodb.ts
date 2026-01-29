import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv'; 
dotenv.config(); 

const uri = process.env.MONGODB_URI || "";
const dbName = process.env.DB_NAME || "QuanLyDoanVien";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!uri) {
    console.log("URI hiện tại:", uri);
    throw new Error("LỖI: MONGODB_URI không tồn tại trong .env");
  }

  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    cachedClient = client;
    cachedDb = db;

    console.log("✅ MongoDB Connected!");
    return { client, db };
  } catch (error) {
    console.error("❌ Lỗi kết nối:", error.message);
    throw error;
  }
}