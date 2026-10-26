const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

let connectionPromise = null;

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL;
  if (!mongoUri) {
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
      minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 2),
      maxIdleTimeMS: Number(process.env.MONGODB_MAX_IDLE_TIME_MS || 60000),
    }).then(() => {
      console.log('✅ MongoDB connected');
      return true;
    }).catch((error) => {
      connectionPromise = null;
      console.error('❌ MongoDB connection error:', error.message);
      throw error;
    });
  }

  await connectionPromise;
  return mongoose.connection.readyState === 1;
}

function isDBConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDBConnected };
