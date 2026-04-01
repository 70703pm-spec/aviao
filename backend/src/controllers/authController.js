const {
    getSession,
    loginUser,
    logoutSession
} = require('../services/authStore');

function extractBearerToken(req) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
        return '';
    }

    return header.slice(7).trim();
}

class AuthController {
    async login(req, res) {
        try {
            const result = await loginUser(req.body?.username, req.body?.password);

            if (!result.ok) {
                return res.status(result.status).json({ message: result.error });
            }

            return res.status(200).json({
                token: result.token,
                expiresAt: result.expiresAt,
                user: result.user
            });
        } catch (error) {
            return res.status(500).json({ message: 'Failed to sign in', error: error.message });
        }
    }

    async session(req, res) {
        try {
            const token = extractBearerToken(req);
            const session = await getSession(token);

            if (!session) {
                return res.status(401).json({ message: 'Session invalid or expired' });
            }

            return res.status(200).json(session);
        } catch (error) {
            return res.status(500).json({ message: 'Failed to resolve session', error: error.message });
        }
    }

    async logout(req, res) {
        try {
            const token = extractBearerToken(req);
            await logoutSession(token);
            return res.status(200).json({ ok: true });
        } catch (error) {
            return res.status(500).json({ message: 'Failed to sign out', error: error.message });
        }
    }
}

module.exports = {
    AuthController
};
