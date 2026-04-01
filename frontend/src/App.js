import React, { useCallback, useEffect, useState } from 'react';
import GodsEyeDashboard from './components/GodsEyeDashboard';
import {
  getAuthApiBaseUrl,
  loginWithCredentials,
  logoutSession,
  restoreSession
} from './services/auth';

const DEFAULT_OPERATOR_USERNAME = process.env.REACT_APP_DEFAULT_LOGIN_USERNAME || 'operator';

function AuthScreen({
  checking,
  username,
  password,
  error,
  busy,
  onUsernameChange,
  onPasswordChange,
  onSubmit
}) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-kicker">God&apos;s Eye Access Control</div>
        <h1>Operator Authentication</h1>
        <p className="auth-copy">
          Sign in before the surveillance grid initializes. Sessions are validated against the backend auth store.
        </p>

        {checking ? (
          <div className="auth-status-card">
            <strong>Checking active session...</strong>
            <span>Secure channel: {getAuthApiBaseUrl()}</span>
          </div>
        ) : (
          <form className="auth-form" onSubmit={onSubmit}>
            <label>
              Username
              <input
                type="text"
                value={username}
                autoComplete="username"
                onChange={(event) => onUsernameChange(event.target.value)}
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

            {error ? <div className="auth-error">{error}</div> : null}

            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? 'Authorizing...' : 'Initialize God’s Eye'}
            </button>
          </form>
        )}

        <div className="auth-meta">
          <div>Seeded operator username: {DEFAULT_OPERATOR_USERNAME}</div>
          <div>Backend: {getAuthApiBaseUrl()}</div>
        </div>
      </div>
    </div>
  );
}

const App = React.memo(() => {
  const [username, setUsername] = useState(DEFAULT_OPERATOR_USERNAME);
  const [password, setPassword] = useState('');
  const [authState, setAuthState] = useState({
    checking: true,
    busy: false,
    error: '',
    user: null
  });

  useEffect(() => {
    let active = true;

    restoreSession()
      .then((session) => {
        if (!active) {
          return;
        }

        setAuthState({
          checking: false,
          busy: false,
          error: '',
          user: session?.user || null
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setAuthState({
          checking: false,
          busy: false,
          error: error.message || '',
          user: null
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();

    setAuthState((previous) => ({
      ...previous,
      busy: true,
      error: ''
    }));

    try {
      const session = await loginWithCredentials({ username, password });
      setPassword('');
      setAuthState({
        checking: false,
        busy: false,
        error: '',
        user: session?.user || null
      });
    } catch (error) {
      setAuthState({
        checking: false,
        busy: false,
        error: error.message || 'Failed to sign in.',
        user: null
      });
    }
  }, [password, username]);

  const handleLogout = useCallback(async () => {
    await logoutSession();
    setPassword('');
    setAuthState({
      checking: false,
      busy: false,
      error: '',
      user: null
    });
  }, []);

  if (!authState.user) {
    return (
      <AuthScreen
        checking={authState.checking}
        username={username}
        password={password}
        error={authState.error}
        busy={authState.busy}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onSubmit={handleSubmit}
      />
    );
  }

  return <GodsEyeDashboard currentUser={authState.user} onLogout={handleLogout} />;
});

App.displayName = 'App';

export default App;
