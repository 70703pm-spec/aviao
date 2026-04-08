const mongoose = require('mongoose');

const dbConfig = {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/mydatabase'
};

let dbConnected = false;
let connectionPromise = null;
let lastDatabaseError = '';

const connectToDatabase = async () => {
    if (mongoose.connection.readyState === 1) {
        dbConnected = true;
        lastDatabaseError = '';
        return mongoose.connection;
    }

    if (connectionPromise) {
        return connectionPromise;
    }

    try {
        connectionPromise = mongoose.connect(dbConfig.uri, {
            serverSelectionTimeoutMS: 10_000
        });

        await connectionPromise;
        dbConnected = true;
        lastDatabaseError = '';
        // Database connected successfully
    } catch (error) {
        dbConnected = false;
        lastDatabaseError = error.message;
        console.warn('Database connection failed, running in degraded mode:', error.message);
    } finally {
        connectionPromise = null;
    }
};

const isDatabaseConnected = () => dbConnected;
const getLastDatabaseError = () => lastDatabaseError;

module.exports = {
    connectToDatabase,
    getLastDatabaseError,
    isDatabaseConnected
};
