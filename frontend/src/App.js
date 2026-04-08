import React, { useCallback, useEffect, useState } from 'react';
import GodsEyeDashboard from './components/GodsEyeDashboard';
import {
  beginOAuthSignIn,
  consumeOAuthRedirectResult,
  fetchAuthProviders,
  getAuthApiBaseUrl,
  loginWithCredentials,
  logoutSession,
  registerWithCredentials,
  restoreSession,
  setStoredSessionToken
} from './services/auth';

const DEFAULT_OPERATOR_USERNAME = process.env.REACT_APP_DEFAULT_LOGIN_USERNAME || 'operator';
const DEFAULT_AUTH_PROVIDERS = {
  google: { enabled: false, label: 'Google' },
  github: { enabled: false, label: 'GitHub' }
};

function createEmptyRegistrationForm() {
  return {
    username: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: ''
  };
}

function AuthScreen({
  checking,
  mode,
  identifier,
  password,
  registration,
  error,
  busy,
  providers,
  onModeChange,
  onIdentifierChange,
  onPasswordChange,
  onRegistrationChange,
  onSubmit,
  onProviderSubmit
}) {
  const enabledProviders = Object.entries(providers).filter(([, provider]) => provider?.enabled);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-kicker">God&apos;s Eye Access Control</div>
        <h1>Operator Authentication</h1>
        <p className="auth-copy">
          Create a local operator account backed by MongoDB, or continue with Google or GitHub when those providers are configured.
          Passwords are stored as secure hashes, never as plain text.
        </p>

        <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={`auth-mode-button ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => onModeChange('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-mode-button ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => onModeChange('signup')}
          >
            Create Account
          </button>
        </div>

        {checking ? (
          <div className="auth-status-card">
            <strong>Checking active session...</strong>
            <span>Secure channel: {getAuthApiBaseUrl()}</span>
          </div>
        ) : (
          <>
            {enabledProviders.length ? (
              <div className="auth-provider-stack">
                {enabledProviders.map(([providerKey, provider]) => (
                  <button
                    key={providerKey}
                    type="button"
                    className="auth-provider-button"
                    disabled={busy}
                    onClick={() => onProviderSubmit(providerKey)}
                  >
                    Continue with {provider.label}
                  </button>
                ))}
              </div>
            ) : null}

            {enabledProviders.length ? (
              <div className="auth-divider" aria-hidden="true">
                <span>or use credentials</span>
              </div>
            ) : null}

            <form className="auth-form" onSubmit={onSubmit}>
              {mode === 'signup' ? (
                <>
                  <label>
                    Username
                    <input
                      type="text"
                      value={registration.username}
                      autoComplete="username"
                      onChange={(event) => onRegistrationChange('username', event.target.value)}
                      placeholder="flight-ops"
                    />
                  </label>

                  <label>
                    Display Name
                    <input
                      type="text"
                      value={registration.displayName}
                      autoComplete="name"
                      onChange={(event) => onRegistrationChange('displayName', event.target.value)}
                      placeholder="Flight Operations"
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      value={registration.email}
                      autoComplete="email"
                      onChange={(event) => onRegistrationChange('email', event.target.value)}
                      placeholder="ops@example.com"
                    />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      value={registration.password}
                      autoComplete="new-password"
                      onChange={(event) => onRegistrationChange('password', event.target.value)}
                      placeholder="Create a password"
                    />
                  </label>

                  <label>
                    Confirm Password
                    <input
                      type="password"
                      value={registration.confirmPassword}
                      autoComplete="new-password"
                      onChange={(event) => onRegistrationChange('confirmPassword', event.target.value)}
                      placeholder="Repeat your password"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Username or Email
                    <input
                      type="text"
                      value={identifier}
                      autoComplete="username"
                      onChange={(event) => onIdentifierChange(event.target.value)}
                      placeholder="operator"
                    />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      value={password}
                      autoComplete="current-password"
                      onChange={(event) => onPasswordChange(event.target.value)}
                      placeholder="Enter operator password"
                    />
                  </label>
                </>
              )}

              {error ? <div className="auth-error">{error}</div> : null}

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy
                  ? 'Authorizing...'
                  : mode === 'signup'
                    ? 'Create Operator Account'
                    : 'Initialize God’s Eye'}
              </button>
            </form>
          </>
        )}

        <div className="auth-meta">
          <div>Seeded operator username: {DEFAULT_OPERATOR_USERNAME}</div>
          <div>Backend: {getAuthApiBaseUrl()}</div>
          <div>OAuth: Google and GitHub buttons appear automatically when backend keys are configured.</div>
        </div>
      </div>
    </div>
  );
}

const App = React.memo(() => {
  const [mode, setMode] = useState('signin');
  const [identifier, setIdentifier] = useState(DEFAULT_OPERATOR_USERNAME);
  const [password, setPassword] = useState('');
  const [registration, setRegistration] = useState(createEmptyRegistrationForm);
  const [authState, setAuthState] = useState({
    checking: true,
    busy: false,
    error: '',
    user: null,
    providers: DEFAULT_AUTH_PROVIDERS
  });

  useEffect(() => {
    let active = true;
    const oauthResult = consumeOAuthRedirectResult();

    if (oauthResult.token) {
      setStoredSessionToken(oauthResult.token);
    }

    Promise.allSettled([
      fetchAuthProviders(),
      restoreSession()
    ]).then(([providersResult, sessionResult]) => {
      if (!active) {
        return;
      }

      const providers = providersResult.status === 'fulfilled'
        ? providersResult.value
        : DEFAULT_AUTH_PROVIDERS;
      const sessionUser = sessionResult.status === 'fulfilled'
        ? sessionResult.value?.user || null
        : null;
      const errorMessage = sessionUser
        ? ''
        : oauthResult.error
          || (sessionResult.status === 'rejected' ? sessionResult.reason?.message || 'Failed to restore session.' : '');

      setAuthState({
        checking: false,
        busy: false,
        error: errorMessage,
        user: sessionUser,
        providers
      });
    });

    return () => {
      active = false;
    };
  }, []);

  const handleModeChange = useCallback((nextMode) => {
    setMode(nextMode);
    setAuthState((previous) => ({
      ...previous,
      error: ''
    }));
  }, []);

  const handleRegistrationChange = useCallback((field, value) => {
    setRegistration((previous) => ({
      ...previous,
      [field]: value
    }));
  }, []);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();

    setAuthState((previous) => ({
      ...previous,
      busy: true,
      error: ''
    }));

    try {
      let session = null;

      if (mode === 'signup') {
        if (registration.password !== registration.confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        session = await registerWithCredentials({
          username: registration.username,
          displayName: registration.displayName,
          email: registration.email,
          password: registration.password
        });

        setIdentifier(registration.username);
        setRegistration(createEmptyRegistrationForm());
        setPassword('');
      } else {
        session = await loginWithCredentials({ identifier, password });
        setPassword('');
      }

      setAuthState((previous) => ({
        ...previous,
        checking: false,
        busy: false,
        error: '',
        user: session?.user || null
      }));
    } catch (error) {
      setAuthState((previous) => ({
        ...previous,
        checking: false,
        busy: false,
        error: error.message || 'Authentication failed.',
        user: null
      }));
    }
  }, [identifier, mode, password, registration]);

  const handleProviderSubmit = useCallback((provider) => {
    setAuthState((previous) => ({
      ...previous,
      busy: true,
      error: ''
    }));

    beginOAuthSignIn(provider, mode);
  }, [mode]);

  const handleLogout = useCallback(async () => {
    await logoutSession();
    setPassword('');
    setRegistration(createEmptyRegistrationForm());
    setAuthState((previous) => ({
      ...previous,
      checking: false,
      busy: false,
      error: '',
      user: null
    }));
  }, []);

  if (!authState.user) {
    return (
      <AuthScreen
        checking={authState.checking}
        mode={mode}
        identifier={identifier}
        password={password}
        registration={registration}
        error={authState.error}
        busy={authState.busy}
        providers={authState.providers}
        onModeChange={handleModeChange}
        onIdentifierChange={setIdentifier}
        onPasswordChange={setPassword}
        onRegistrationChange={handleRegistrationChange}
        onSubmit={handleSubmit}
        onProviderSubmit={handleProviderSubmit}
      />
    );
  }

  return <GodsEyeDashboard currentUser={authState.user} onLogout={handleLogout} />;
});

App.displayName = 'App';

export default App;
