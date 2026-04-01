const mongoose = require('mongoose');

const dbConfig = {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/mydatabase',
    options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    },
};

let dbConnected = false;

const connectToDatabase = async () => {
    try {
        await mongoose.connect(dbConfig.uri, dbConfig.options);
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
