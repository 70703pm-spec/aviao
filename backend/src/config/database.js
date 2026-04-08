const mongoose = require('mongoose');

const dbConfig = {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/mydatabase'
};

let dbConnected = false;

const connectToDatabase = async () => {
    try {
        await mongoose.connect(dbConfig.uri);
        dbConnected = true;
        // Database connected successfully
    } catch (error) {
        dbConnected = false;
        console.warn('Database connection failed, running in degraded mode:', error.message);
    }
};

const isDatabaseConnected = () => dbConnected;

module.exports = {
    connectToDatabase,
    isDatabaseConnected,
};
