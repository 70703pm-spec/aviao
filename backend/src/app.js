const fs = require('fs');
const path = require('path');

const envFilePath = path.resolve(__dirname, '../.env');

if (typeof process.loadEnvFile === 'function' && fs.existsSync(envFilePath)) {
    process.loadEnvFile(envFilePath);
}

const express = require('express');
const bodyParser = require('body-parser');
const { setRoutes } = require('./routes/index');
const { connectToDatabase, isDatabaseConnected } = require('./config/database');
const { ensureAuthStore } = require('./services/authStore');

const app = express();
const PORT = process.env.PORT || 3002;
const configuredOrigins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : ['http://localhost:3000', 'http://localhost:3004'];

const serverStartedAt = Date.now();
const requestCounts = new Map();
const requestLatency = new Map();

app.use((req, res, next) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        const routeKey = `${req.method} ${req.path}`;
        const statusKey = `${routeKey} ${res.statusCode}`;

        requestCounts.set(statusKey, (requestCounts.get(statusKey) || 0) + 1);

        const latencyBucket = requestLatency.get(routeKey) || { total: 0, count: 0 };
        latencyBucket.total += durationMs;
        latencyBucket.count += 1;
        requestLatency.set(routeKey, latencyBucket);
    });

    next();
});

// Middleware
app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    const allowOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
        ? requestOrigin
        : allowedOrigins[0];

    res.header('Access-Control-Allow-Origin', allowOrigin);
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    return next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/health', async (req, res) => {
    if (!isDatabaseConnected()) {
        await connectToDatabase();
    }

    res.status(200).json({
        status: 'ok',
        uptimeSeconds: Math.round((Date.now() - serverStartedAt) / 1000),
        databaseConnected: isDatabaseConnected()
    });
});

app.get('/metrics', (req, res) => {
    const lines = [];

    lines.push('# HELP gods_eye_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE gods_eye_uptime_seconds gauge');
    lines.push(`gods_eye_uptime_seconds ${Math.max(0, Math.round((Date.now() - serverStartedAt) / 1000))}`);

    lines.push('# HELP gods_eye_backend_db_connected Database connectivity status');
    lines.push('# TYPE gods_eye_backend_db_connected gauge');
    lines.push(`gods_eye_backend_db_connected ${isDatabaseConnected() ? 1 : 0}`);

    lines.push('# HELP gods_eye_http_requests_total Total HTTP requests observed');
    lines.push('# TYPE gods_eye_http_requests_total counter');

    requestCounts.forEach((count, key) => {
        const [method, path, status] = key.split(' ');
        lines.push(`gods_eye_http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
    });

    lines.push('# HELP gods_eye_http_request_duration_ms_avg Average request latency in milliseconds');
    lines.push('# TYPE gods_eye_http_request_duration_ms_avg gauge');

    requestLatency.forEach((bucket, key) => {
        const [method, path] = key.split(' ');
        const avg = bucket.count > 0 ? bucket.total / bucket.count : 0;
        lines.push(`gods_eye_http_request_duration_ms_avg{method="${method}",path="${path}"} ${avg.toFixed(3)}`);
    });

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.status(200).send(`${lines.join('\n')}\n`);
});

// Connect eagerly so the same setup works in local dev and on Vercel.
const databaseStartup = connectToDatabase()
    .then(() => ensureAuthStore().catch((error) => {
        console.warn('Auth store bootstrap failed:', error.message);
    }))
    .catch(() => null);

// Set up routes
setRoutes(app);

if (require.main === module) {
    databaseStartup.finally(() => {
        app.listen(PORT, () => {
            // Server started successfully
        });
    });
}

module.exports = app;
