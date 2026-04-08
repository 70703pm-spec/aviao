const mongoose = require('mongoose');

const authProviderSchema = new mongoose.Schema({
    provider: {
        type: String,
        enum: ['local', 'google', 'github'],
        required: true
    },
    providerId: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: undefined
    },
    linkedAt: {
        type: Date,
        default: Date.now
    }
}, {
    _id: false
});

const sessionSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    tokenHash: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    lastSeenAt: {
        type: Date,
        required: true
    }
}, {
    _id: false
});

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        sparse: true,
        default: undefined
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        trim: true,
        default: 'operator'
    },
    passwordHash: {
        type: String,
        default: ''
    },
    authProviders: {
        type: [authProviderSchema],
        default: []
    },
    sessions: {
        type: [sessionSchema],
        default: []
    },
    lastLoginAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

userSchema.index(
    {
        'authProviders.provider': 1,
        'authProviders.providerId': 1
    },
    {
        unique: true,
        sparse: true
    }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
