const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const configuredAuthDbFile = process.env.AUTH_DB_FILE;
const AUTH_DB_FILE = configuredAuthDbFile
    ? (path.isAbsolute(configuredAuthDbFile)
        ? configuredAuthDbFile
        : path.resolve(__dirname, '../../', configuredAuthDbFile))
    : path.join(__dirname, '../../data/users.json');
const DEFAULT_USERNAME = (process.env.AUTH_DEFAULT_USERNAME || 'operator').trim().toLowerCase();
const DEFAULT_PASSWORD = process.env.AUTH_DEFAULT_PASSWORD || 'GodsEye2026!';
const DEFAULT_DISPLAY_NAME = process.env.AUTH_DEFAULT_DISPLAY_NAME || 'Primary Operator';
const DEFAULT_ROLE = process.env.AUTH_DEFAULT_ROLE || 'administrator';
const SESSION_TTL_DAYS = Math.max(1, Number(process.env.AUTH_SESSION_TTL_DAYS || 14));

function nowIso() {
    return new Date().toISOString();
}

function createId(prefix) {
    return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash) {
    if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
        return false;
    }

    const [salt, expectedHash] = storedHash.split(':');
    const candidateHash = crypto.scryptSync(password, salt, 64).toString('hex');

    return crypto.timingSafeEqual(
        Buffer.from(candidateHash, 'hex'),
        Buffer.from(expectedHash, 'hex')
    );
}

function hashSessionToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function buildSeedUser() {
    const createdAt = nowIso();

    return {
        id: createId('usr'),
        username: DEFAULT_USERNAME,
        displayName: DEFAULT_DISPLAY_NAME,
        role: DEFAULT_ROLE,
        passwordHash: hashPassword(DEFAULT_PASSWORD),
        sessions: [],
        createdAt,
        updatedAt: createdAt
    };
}

function sanitizeUser(user) {
    return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
}

async function writeStore(store) {
    await fs.mkdir(path.dirname(AUTH_DB_FILE), { recursive: true });
    await fs.writeFile(AUTH_DB_FILE, JSON.stringify(store, null, 2));
}

async function readStore() {
    try {
        const raw = await fs.readFile(AUTH_DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed?.users)) {
            return parsed;
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn('Auth store read failed, reseeding:', error.message);
        }
    }

    const seededStore = {
        users: [buildSeedUser()]
    };

    await writeStore(seededStore);
    return seededStore;
}

async function ensureAuthStore() {
    return readStore();
}

async function loginUser(identifier, password) {
    const normalizedIdentifier = (identifier || '').trim().toLowerCase();
    if (!normalizedIdentifier || !password) {
        return {
            ok: false,
            status: 400,
            error: 'Username and password are required.'
        };
    }

    const store = await readStore();
    const user = store.users.find((entry) => entry.username === normalizedIdentifier);

    if (!user || !verifyPassword(password, user.passwordHash)) {
        return {
            ok: false,
            status: 401,
            error: 'Invalid credentials.'
        };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const session = {
        id: createId('ses'),
        tokenHash: hashSessionToken(token),
        createdAt: nowIso(),
        expiresAt,
        lastSeenAt: nowIso()
    };

    user.sessions = Array.isArray(user.sessions) ? user.sessions : [];
    user.sessions = [...user.sessions.filter((entry) => new Date(entry.expiresAt).getTime() > Date.now()), session].slice(-8);
    user.updatedAt = nowIso();

    await writeStore(store);

    return {
        ok: true,
        token,
        user: sanitizeUser(user),
        expiresAt
    };
}

async function getSession(token) {
    if (!token) {
        return null;
    }

    const tokenHash = hashSessionToken(token);
    const store = await readStore();
    const now = Date.now();
    let dirty = false;

    for (const user of store.users) {
        const sessions = Array.isArray(user.sessions) ? user.sessions : [];
        const validSessions = sessions.filter((entry) => new Date(entry.expiresAt).getTime() > now);

        if (validSessions.length !== sessions.length) {
            dirty = true;
        }

        const activeSession = validSessions.find((entry) => entry.tokenHash === tokenHash);
        user.sessions = validSessions;

        if (activeSession) {
            activeSession.lastSeenAt = nowIso();
            user.updatedAt = nowIso();
            await writeStore(store);

            return {
                user: sanitizeUser(user),
                expiresAt: activeSession.expiresAt
            };
        }
    }

    if (dirty) {
        await writeStore(store);
    }

    return null;
}

async function logoutSession(token) {
    if (!token) {
        return false;
    }

    const tokenHash = hashSessionToken(token);
    const store = await readStore();
    let updated = false;

    store.users = store.users.map((user) => {
        const sessions = Array.isArray(user.sessions) ? user.sessions : [];
        const filteredSessions = sessions.filter((entry) => entry.tokenHash !== tokenHash);

        if (filteredSessions.length !== sessions.length) {
            updated = true;
            return {
                ...user,
                sessions: filteredSessions,
                updatedAt: nowIso()
            };
        }

        return user;
    });

    if (updated) {
        await writeStore(store);
    }

    return updated;
}

module.exports = {
    ensureAuthStore,
    loginUser,
    getSession,
    logoutSession,
    sanitizeUser
};
