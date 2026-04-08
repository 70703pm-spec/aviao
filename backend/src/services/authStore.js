const crypto = require('crypto');
const mongoose = require('mongoose');
const { connectToDatabase } = require('../config/database');
const User = require('../models/user');

const DEFAULT_USERNAME = (process.env.AUTH_DEFAULT_USERNAME || 'operator').trim().toLowerCase();
const DEFAULT_PASSWORD = process.env.AUTH_DEFAULT_PASSWORD || 'GodsEye2026!';
const DEFAULT_DISPLAY_NAME = process.env.AUTH_DEFAULT_DISPLAY_NAME || 'Primary Operator';
const DEFAULT_EMAIL = normalizeEmail(process.env.AUTH_DEFAULT_EMAIL || '');
const DEFAULT_ROLE = process.env.AUTH_DEFAULT_ROLE || 'administrator';
const SESSION_TTL_DAYS = Math.max(1, Number(process.env.AUTH_SESSION_TTL_DAYS || 14));
const OAUTH_STATE_TTL_MS = Math.max(60_000, Number(process.env.AUTH_OAUTH_STATE_TTL_MS || 10 * 60 * 1000));
const OAUTH_STATE_SECRET = process.env.AUTH_STATE_SECRET || 'development-oauth-state-secret';
const PROVIDER_LABELS = {
    google: 'Google',
    github: 'GitHub'
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

function nowDate() {
    return new Date();
}

function isDatabaseReady() {
    return mongoose.connection.readyState === 1;
}

function databaseUnavailableResult() {
    return {
        ok: false,
        status: 503,
        error: 'Authentication database unavailable. Start MongoDB and set MONGO_URI before using sign in.'
    };
}

async function ensureAuthDatabaseReady() {
    if (isDatabaseReady()) {
        return true;
    }

    await connectToDatabase();
    return isDatabaseReady();
}

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeEmail(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || '';
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

function toBase64Url(value) {
    return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

function safeCompare(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getFrontendBaseUrl() {
    const configuredOrigin = String(process.env.CORS_ORIGIN || '')
        .split(',')
        .map((value) => value.trim())
        .find(Boolean);

    return (process.env.FRONTEND_URL || configuredOrigin || 'http://localhost:3004').replace(/\/$/, '');
}

function signOAuthState(payload) {
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(encodedPayload).digest('base64url');
    return `${encodedPayload}.${signature}`;
}

function verifyOAuthState(state) {
    if (!state || !state.includes('.')) {
        throw new Error('Missing OAuth state payload.');
    }

    const [encodedPayload, signature] = state.split('.');
    const expectedSignature = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(encodedPayload).digest('base64url');

    if (!safeCompare(signature, expectedSignature)) {
        throw new Error('OAuth state verification failed.');
    }

    const payload = JSON.parse(fromBase64Url(encodedPayload));
    const issuedAt = Number(payload?.issuedAt || 0);

    if (!issuedAt || Date.now() - issuedAt > OAUTH_STATE_TTL_MS) {
        throw new Error('OAuth request expired. Try again.');
    }

    return payload;
}

function normalizeDisplayName(value, fallback = '') {
    const trimmed = String(value || '').trim();
    return trimmed || fallback;
}

function slugifyUsername(value) {
    const trimmed = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return trimmed || 'pilot';
}

async function generateUniqueUsername(seed) {
    const base = slugifyUsername(seed).slice(0, 24);
    let candidate = base;
    let suffix = 1;

    while (await User.exists({ username: candidate })) {
        const suffixLabel = `-${suffix}`;
        candidate = `${base.slice(0, Math.max(1, 24 - suffixLabel.length))}${suffixLabel}`;
        suffix += 1;
    }

    return candidate;
}

function sanitizeUser(user) {
    const authProviders = Array.isArray(user.authProviders) ? user.authProviders : [];
    const providers = [...new Set(authProviders.map((entry) => entry.provider))];

    return {
        id: String(user._id),
        username: user.username,
        email: user.email || '',
        displayName: user.displayName,
        role: user.role,
        providers,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt
    };
}

function buildOAuthProviderConfig(provider) {
    const backendBaseUrl = (process.env.AUTH_BASE_URL || `http://localhost:${process.env.PORT || 3002}`).replace(/\/$/, '');
    const callbackUrl = `${backendBaseUrl}/api/auth/oauth/${provider}/callback`;

    if (provider === 'google') {
        return {
            provider,
            label: PROVIDER_LABELS.google,
            clientId: process.env.AUTH_GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET || '',
            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
            callbackUrl,
            scope: ['openid', 'email', 'profile']
        };
    }

    if (provider === 'github') {
        return {
            provider,
            label: PROVIDER_LABELS.github,
            clientId: process.env.AUTH_GITHUB_CLIENT_ID || '',
            clientSecret: process.env.AUTH_GITHUB_CLIENT_SECRET || '',
            authorizationUrl: 'https://github.com/login/oauth/authorize',
            tokenUrl: 'https://github.com/login/oauth/access_token',
            profileUrl: 'https://api.github.com/user',
            emailUrl: 'https://api.github.com/user/emails',
            callbackUrl,
            scope: ['read:user', 'user:email']
        };
    }

    return null;
}

function getConfiguredAuthProviders() {
    return ['google', 'github'].reduce((providers, provider) => {
        const config = buildOAuthProviderConfig(provider);

        providers[provider] = {
            enabled: Boolean(config?.clientId && config?.clientSecret),
            label: PROVIDER_LABELS[provider]
        };

        return providers;
    }, {});
}

function pruneExpiredSessions(user) {
    const sessions = Array.isArray(user.sessions) ? user.sessions : [];
    const now = Date.now();
    const validSessions = sessions.filter((entry) => new Date(entry.expiresAt).getTime() > now);
    const changed = validSessions.length !== sessions.length || !Array.isArray(user.sessions);

    if (changed) {
        user.sessions = validSessions;
    }

    return changed;
}

async function createSessionForUser(user) {
    const token = crypto.randomBytes(32).toString('hex');
    const createdAt = nowDate();
    const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const session = {
        id: createId('ses'),
        tokenHash: hashSessionToken(token),
        createdAt,
        expiresAt,
        lastSeenAt: createdAt
    };

    pruneExpiredSessions(user);
    user.sessions = [...(Array.isArray(user.sessions) ? user.sessions : []), session].slice(-8);
    user.lastLoginAt = createdAt;

    await user.save();

    return {
        ok: true,
        token,
        user: sanitizeUser(user),
        expiresAt: expiresAt.toISOString()
    };
}

async function ensureAuthStore() {
    if (!await ensureAuthDatabaseReady()) {
        return null;
    }

    await User.init();

    const seedUsername = normalizeUsername(DEFAULT_USERNAME);
    const seedEmail = DEFAULT_EMAIL || undefined;
    const existingUser = await User.findOne({
        $or: [
            { username: seedUsername },
            ...(seedEmail ? [{ email: seedEmail }] : [])
        ]
    });

    if (existingUser) {
        return existingUser;
    }

    const createdAt = nowDate();
    const providerId = seedEmail || seedUsername;

    return User.create({
        username: seedUsername,
        email: seedEmail,
        displayName: DEFAULT_DISPLAY_NAME,
        role: DEFAULT_ROLE,
        passwordHash: hashPassword(DEFAULT_PASSWORD),
        authProviders: [{
            provider: 'local',
            providerId,
            email: seedEmail,
            linkedAt: createdAt
        }],
        sessions: [],
        lastLoginAt: null
    });
}

async function loginUser(identifier, password) {
    if (!await ensureAuthDatabaseReady()) {
        return databaseUnavailableResult();
    }

    const normalizedIdentifier = normalizeUsername(identifier);
    const normalizedEmail = normalizeEmail(identifier);

    if (!normalizedIdentifier || !password) {
        return {
            ok: false,
            status: 400,
            error: 'Username or email and password are required.'
        };
    }

    const user = await User.findOne({
        $or: [
            { username: normalizedIdentifier },
            { email: normalizedEmail }
        ]
    });

    if (!user) {
        return {
            ok: false,
            status: 401,
            error: 'Invalid credentials.'
        };
    }

    if (!user.passwordHash) {
        return {
            ok: false,
            status: 401,
            error: 'This account uses Google or GitHub sign in. Use that provider to continue.'
        };
    }

    if (!verifyPassword(password, user.passwordHash)) {
        return {
            ok: false,
            status: 401,
            error: 'Invalid credentials.'
        };
    }

    return createSessionForUser(user);
}

async function registerUser({
    username,
    email,
    displayName,
    password
}) {
    if (!await ensureAuthDatabaseReady()) {
        return databaseUnavailableResult();
    }

    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);
    const resolvedDisplayName = normalizeDisplayName(displayName);
    const trimmedPassword = String(password || '');

    if (!normalizedUsername || !resolvedDisplayName || !normalizedEmail || !trimmedPassword) {
        return {
            ok: false,
            status: 400,
            error: 'Username, display name, email, and password are required.'
        };
    }

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
        return {
            ok: false,
            status: 400,
            error: 'Username must be 3-32 characters and can use letters, numbers, dots, dashes, or underscores.'
        };
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
        return {
            ok: false,
            status: 400,
            error: 'Enter a valid email address.'
        };
    }

    if (trimmedPassword.length < 8) {
        return {
            ok: false,
            status: 400,
            error: 'Password must be at least 8 characters.'
        };
    }

    const usernameTaken = await User.exists({ username: normalizedUsername });
    if (usernameTaken) {
        return {
            ok: false,
            status: 409,
            error: 'That username is already in use.'
        };
    }

    const emailTaken = await User.exists({ email: normalizedEmail });
    if (emailTaken) {
        return {
            ok: false,
            status: 409,
            error: 'That email address is already in use.'
        };
    }

    const createdAt = nowDate();
    const user = await User.create({
        username: normalizedUsername,
        email: normalizedEmail,
        displayName: resolvedDisplayName,
        role: 'operator',
        passwordHash: hashPassword(trimmedPassword),
        authProviders: [{
            provider: 'local',
            providerId: normalizedEmail,
            email: normalizedEmail,
            linkedAt: createdAt
        }],
        sessions: [],
        lastLoginAt: null
    });

    return createSessionForUser(user);
}

async function getSession(token) {
    if (!token) {
        return null;
    }

    if (!await ensureAuthDatabaseReady()) {
        return null;
    }

    const tokenHash = hashSessionToken(token);
    const user = await User.findOne({
        'sessions.tokenHash': tokenHash
    });

    if (!user) {
        return null;
    }

    const pruned = pruneExpiredSessions(user);
    const activeSession = (Array.isArray(user.sessions) ? user.sessions : []).find((entry) => entry.tokenHash === tokenHash);

    if (!activeSession) {
        if (pruned) {
            await user.save();
        }

        return null;
    }

    activeSession.lastSeenAt = nowDate();
    await user.save();

    return {
        user: sanitizeUser(user),
        expiresAt: activeSession.expiresAt
    };
}

async function logoutSession(token) {
    if (!token) {
        return false;
    }

    if (!await ensureAuthDatabaseReady()) {
        return false;
    }

    const tokenHash = hashSessionToken(token);
    const user = await User.findOne({
        'sessions.tokenHash': tokenHash
    });

    if (!user) {
        return false;
    }

    const sessionCount = Array.isArray(user.sessions) ? user.sessions.length : 0;
    user.sessions = (user.sessions || []).filter((entry) => entry.tokenHash !== tokenHash);

    if (user.sessions.length === sessionCount) {
        return false;
    }

    await user.save();
    return true;
}

function buildFrontendAuthRedirect({ token = '', error = '' }) {
    const redirectUrl = new URL(getFrontendBaseUrl());

    if (token) {
        redirectUrl.searchParams.set('authToken', token);
    }

    if (error) {
        redirectUrl.searchParams.set('authError', error);
    }

    return redirectUrl.toString();
}

function buildOAuthAuthorizationUrl(provider, mode = 'signin') {
    const config = buildOAuthProviderConfig(provider);

    if (!config) {
        return {
            ok: false,
            status: 404,
            error: 'Unsupported authentication provider.'
        };
    }

    if (!config.clientId || !config.clientSecret) {
        return {
            ok: false,
            status: 503,
            error: `${config.label} sign in is not configured on the backend.`
        };
    }

    const state = signOAuthState({
        provider,
        mode,
        issuedAt: Date.now(),
        nonce: crypto.randomBytes(12).toString('hex')
    });

    const url = new URL(config.authorizationUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.scope.join(' '));
    url.searchParams.set('state', state);

    if (provider === 'google') {
        url.searchParams.set('access_type', 'offline');
        url.searchParams.set('prompt', 'consent');
    }

    return {
        ok: true,
        status: 302,
        url: url.toString()
    };
}

async function exchangeGoogleCodeForProfile(code) {
    const config = buildOAuthProviderConfig('google');
    const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.callbackUrl
    });

    const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token) {
        throw new Error(tokenPayload.error_description || tokenPayload.error || 'Google token exchange failed.');
    }

    const profileResponse = await fetch(config.profileUrl, {
        headers: {
            Authorization: `Bearer ${tokenPayload.access_token}`
        }
    });

    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.sub) {
        throw new Error(profile.error_description || 'Google profile lookup failed.');
    }

    return {
        provider: 'google',
        providerId: String(profile.sub),
        email: normalizeEmail(profile.email),
        usernameHint: profile.email ? profile.email.split('@')[0] : 'google-user',
        displayName: normalizeDisplayName(profile.name, 'Google User')
    };
}

async function exchangeGitHubCodeForProfile(code) {
    const config = buildOAuthProviderConfig('github');
    const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.callbackUrl
    });

    const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token) {
        throw new Error(tokenPayload.error_description || tokenPayload.error || 'GitHub token exchange failed.');
    }

    const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenPayload.access_token}`,
        'User-Agent': 'aviao-auth'
    };

    const [profileResponse, emailsResponse] = await Promise.all([
        fetch(config.profileUrl, { headers }),
        fetch(config.emailUrl, { headers })
    ]);

    const profile = await profileResponse.json();
    const emails = await emailsResponse.json();

    if (!profileResponse.ok || !profile.id) {
        throw new Error(profile.message || 'GitHub profile lookup failed.');
    }

    const verifiedEmail = Array.isArray(emails)
        ? (emails.find((entry) => entry.primary && entry.verified)
            || emails.find((entry) => entry.verified)
            || emails[0])
        : null;

    return {
        provider: 'github',
        providerId: String(profile.id),
        email: normalizeEmail(verifiedEmail?.email || profile.email || ''),
        usernameHint: profile.login || 'github-user',
        displayName: normalizeDisplayName(profile.name, profile.login || 'GitHub User')
    };
}

async function exchangeOAuthCodeForProfile(provider, code) {
    if (provider === 'google') {
        return exchangeGoogleCodeForProfile(code);
    }

    if (provider === 'github') {
        return exchangeGitHubCodeForProfile(code);
    }

    throw new Error('Unsupported authentication provider.');
}

async function upsertOAuthUser(profile) {
    const email = profile.email || undefined;
    const user = await User.findOne({
        $or: [
            {
                authProviders: {
                    $elemMatch: {
                        provider: profile.provider,
                        providerId: profile.providerId
                    }
                }
            },
            ...(email ? [{ email }] : [])
        ]
    });

    if (user) {
        const hasProvider = (user.authProviders || []).some((entry) => (
            entry.provider === profile.provider && entry.providerId === profile.providerId
        ));

        if (!hasProvider) {
            user.authProviders.push({
                provider: profile.provider,
                providerId: profile.providerId,
                email,
                linkedAt: nowDate()
            });
        }

        if (!user.email && email) {
            user.email = email;
        }

        if (!user.displayName && profile.displayName) {
            user.displayName = profile.displayName;
        }

        await user.save();
        return user;
    }

    const username = await generateUniqueUsername(profile.usernameHint || profile.displayName || profile.provider);

    return User.create({
        username,
        email,
        displayName: profile.displayName,
        role: 'operator',
        passwordHash: '',
        authProviders: [{
            provider: profile.provider,
            providerId: profile.providerId,
            email,
            linkedAt: nowDate()
        }],
        sessions: [],
        lastLoginAt: null
    });
}

async function completeOAuthLogin(provider, code, state) {
    if (!await ensureAuthDatabaseReady()) {
        return databaseUnavailableResult();
    }

    if (!code) {
        return {
            ok: false,
            status: 400,
            error: 'Missing authorization code from provider.'
        };
    }

    let statePayload;

    try {
        statePayload = verifyOAuthState(state);
    } catch (error) {
        return {
            ok: false,
            status: 400,
            error: error.message
        };
    }

    if (statePayload.provider !== provider) {
        return {
            ok: false,
            status: 400,
            error: 'OAuth state did not match the selected provider.'
        };
    }

    try {
        const profile = await exchangeOAuthCodeForProfile(provider, code);
        const user = await upsertOAuthUser(profile);
        return createSessionForUser(user);
    } catch (error) {
        return {
            ok: false,
            status: 502,
            error: error.message || 'OAuth sign in failed.'
        };
    }
}

module.exports = {
    buildFrontendAuthRedirect,
    buildOAuthAuthorizationUrl,
    completeOAuthLogin,
    ensureAuthStore,
    getConfiguredAuthProviders,
    getSession,
    loginUser,
    logoutSession,
    registerUser,
    sanitizeUser
};
