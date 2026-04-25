import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

let replSet: MongoMemoryReplSet;

export async function setupDB() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
}

export async function teardownDB() {
  await mongoose.disconnect();
  await replSet.stop();
}

export async function clearDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
