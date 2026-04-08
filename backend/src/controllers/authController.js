const {
    buildFrontendAuthRedirect,
    buildOAuthAuthorizationUrl,
    completeOAuthLogin,
    getConfiguredAuthProviders,
    getSession,
    loginUser,
    logoutSession,
    registerUser
} = require('../services/authStore');

function extractBearerToken(req) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
        return '';
    }

    return header.slice(7).trim();
}

class AuthController {
    async register(req, res) {
        try {
            const result = await registerUser(req.body || {});

            if (!result.ok) {
                return res.status(result.status).json({ message: result.error });
            }

            return res.status(201).json({
                token: result.token,
                expiresAt: result.expiresAt,
                user: result.user
            });
        } catch (error) {
            return res.status(500).json({ message: 'Failed to create account', error: error.message });
        }
    }

    async login(req, res) {
        try {
            const result = await loginUser(
                req.body?.identifier || req.body?.username || req.body?.email,
                req.body?.password
            );

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

    providers(req, res) {
        return res.status(200).json(getConfiguredAuthProviders());
    }

    startOAuth(req, res) {
        const provider = String(req.params.provider || '').toLowerCase();
        const mode = String(req.query.mode || 'signin').toLowerCase();
        const result = buildOAuthAuthorizationUrl(provider, mode);

        if (!result.ok) {
            return res.status(result.status).json({ message: result.error });
        }

        return res.redirect(result.url);
    }

    async handleOAuthCallback(req, res) {
        const provider = String(req.params.provider || '').toLowerCase();
        const providerError = req.query?.error;

        if (providerError) {
            return res.redirect(buildFrontendAuthRedirect({
                error: `${provider} authentication was canceled or denied.`
            }));
        }

        try {
            const result = await completeOAuthLogin(
                provider,
                req.query?.code,
                req.query?.state
            );

            if (!result.ok) {
                return res.redirect(buildFrontendAuthRedirect({ error: result.error }));
            }

            return res.redirect(buildFrontendAuthRedirect({ token: result.token }));
        } catch (error) {
            return res.redirect(buildFrontendAuthRedirect({
                error: error.message || 'OAuth sign in failed.'
            }));
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
