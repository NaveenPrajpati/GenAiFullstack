/**
 * Session lifecycle: rehydration, the credential calls, and sign-out.
 *
 * axios is replaced with a factory whose clients record the config they were
 * built with, which is how these tests check *which* token a call was made
 * with — `apiClient(token)` bakes the Authorization header in at construction
 * rather than per request.
 *
 * The http layer is stubbed down to `setOnSessionExpired` (the only thing
 * AuthContext imports from it) so the handler it registers can be fired
 * directly; that path is covered end-to-end in `services/__tests__/http.test.ts`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { BASE_URL, UserApis } from '@/services/api';
import { AuthProvider, useAuth, type User } from '../AuthContext';

const mockPost = jest.fn();
const mockGet = jest.fn();
/** Records every `axios.create` config, so tests can read the baked-in header. */
const mockCreate = jest.fn();

jest.mock('axios', () => {
  const create = (config: any) => {
    mockCreate(config);
    return {
      post: (...args: any[]) => mockPost(...args),
      get: (...args: any[]) => mockGet(...args),
    };
  };
  return { __esModule: true, default: { create }, create };
});

const mockSessionExpired: { current: (() => void) | null } = { current: null };
jest.mock('@/services/http', () => ({
  setOnSessionExpired: (handler: (() => void) | null) => {
    mockSessionExpired.current = handler;
  },
}));

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

const USER: User = {
  id: 'u1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'user',
  description: null,
  is_guest: false,
  expires_at: null,
};

type Auth = ReturnType<typeof useAuth>;

async function renderAuth() {
  const captured: { current: Auth } = { current: null as unknown as Auth };
  function Probe() {
    captured.current = useAuth();
    return null;
  }

  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });

  // A getter, not a snapshot — the value is replaced on every re-render.
  return { auth: () => captured.current, tree };
}

/** The Authorization header the most recent `apiClient(...)` was built with. */
function lastAuthHeader(): string | undefined {
  const config = mockCreate.mock.calls.at(-1)?.[0];
  return config?.headers?.Authorization;
}

async function storedUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** A signed-in provider, with the login bookkeeping cleared away. */
async function renderSignedIn() {
  mockPost.mockResolvedValueOnce({
    data: { token: 'token-1', refresh_token: 'refresh-1', user: USER },
  });
  const rendered = await renderAuth();
  await act(async () => {
    await rendered.auth().login(USER.email, 'pw');
  });
  mockPost.mockReset();
  mockCreate.mockClear();
  return rendered;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockPost.mockReset();
  mockGet.mockReset();
  mockCreate.mockClear();
  mockSessionExpired.current = null;
});

describe('useAuth', () => {
  it('refuses to be used outside a provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Orphan() {
      useAuth();
      return null;
    }

    // Inside `act`, or React 19 defers the render and the throw lands in
    // whichever test flushes next.
    expect(() =>
      act(() => {
        TestRenderer.create(<Orphan />);
      })
    ).toThrow('useAuth must be used within AuthProvider');

    consoleError.mockRestore();
  });
});

describe('rehydration', () => {
  it('restores a persisted session and reports ready', async () => {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, 'token-1'],
      [REFRESH_KEY, 'refresh-1'],
      [USER_KEY, JSON.stringify(USER)],
    ]);

    const { auth } = await renderAuth();

    expect(auth().token).toBe('token-1');
    expect(auth().user).toEqual(USER);
    expect(auth().isReady).toBe(true);
  });

  it('stays signed out when the stored user is missing', async () => {
    // A token with no user record is a half-written session; trusting it would
    // put the app past the auth gate with nothing to render.
    await AsyncStorage.setItem(TOKEN_KEY, 'token-1');

    const { auth } = await renderAuth();

    expect(auth().token).toBeNull();
    expect(auth().user).toBeNull();
    expect(auth().isReady).toBe(true);
  });

  it('reports ready even when the stored user is corrupt', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await AsyncStorage.multiSet([
      [TOKEN_KEY, 'token-1'],
      [USER_KEY, 'not json'],
    ]);

    const { auth } = await renderAuth();

    // Never leave the app stuck on the splash screen because of bad storage.
    expect(auth().isReady).toBe(true);
    expect(auth().user).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('is ready with an empty session on a fresh install', async () => {
    const { auth } = await renderAuth();

    expect(auth().isReady).toBe(true);
    expect(auth().token).toBeNull();
  });
});

describe('login', () => {
  it('posts credentials and persists the returned session', async () => {
    mockPost.mockResolvedValue({
      data: { token: 'token-1', refresh_token: 'refresh-1', user: USER },
    });
    const { auth } = await renderAuth();

    await act(async () => {
      await auth().login('ada@example.com', 'hunter2');
    });

    expect(mockPost).toHaveBeenCalledWith(UserApis.login, {
      email: 'ada@example.com',
      password: 'hunter2',
    });
    expect(auth().token).toBe('token-1');
    expect(auth().user).toEqual(USER);
    await expect(AsyncStorage.getItem(TOKEN_KEY)).resolves.toBe('token-1');
    await expect(AsyncStorage.getItem(REFRESH_KEY)).resolves.toBe('refresh-1');
    await expect(storedUser()).resolves.toEqual(USER);
  });

  it('signs in unauthenticated, against the configured base URL', async () => {
    mockPost.mockResolvedValue({ data: { token: 'token-1', user: USER } });
    const { auth } = await renderAuth();

    await act(async () => {
      await auth().login('ada@example.com', 'hunter2');
    });

    expect(mockCreate).toHaveBeenLastCalledWith({ baseURL: BASE_URL, headers: {} });
  });

  it('writes no refresh key when the server does not issue one', async () => {
    mockPost.mockResolvedValue({ data: { token: 'token-1', user: USER } });
    const { auth } = await renderAuth();

    await act(async () => {
      await auth().login('ada@example.com', 'hunter2');
    });

    await expect(AsyncStorage.getItem(REFRESH_KEY)).resolves.toBeNull();
    expect(auth().token).toBe('token-1');
  });

  it('leaves the session untouched when the credentials are rejected', async () => {
    mockPost.mockRejectedValue(new Error('401'));
    const { auth } = await renderAuth();

    await act(async () => {
      await expect(auth().login('ada@example.com', 'wrong')).rejects.toThrow('401');
    });

    expect(auth().token).toBeNull();
    await expect(AsyncStorage.getItem(TOKEN_KEY)).resolves.toBeNull();
  });
});

describe('signup', () => {
  // The context type declares `(email, name, password)` but the provider reads
  // its arguments as `(name, email, password)` — which is what the signup screen
  // passes. This pins the behaviour that actually ships.
  it('takes (name, email, password) and posts them under the right keys', async () => {
    mockPost.mockResolvedValue({
      data: { token: 'token-1', refresh_token: 'refresh-1', user: USER },
    });
    const { auth } = await renderAuth();

    await act(async () => {
      await auth().signup('Ada Lovelace', 'ada@example.com', 'hunter2');
    });

    expect(mockPost).toHaveBeenCalledWith(UserApis.signup, {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'hunter2',
    });
    expect(auth().token).toBe('token-1');
  });
});

describe('guest accounts', () => {
  it('creates a guest session with no body', async () => {
    const guest = { ...USER, is_guest: true };
    mockPost.mockResolvedValue({ data: { token: 'guest-token', user: guest } });
    const { auth } = await renderAuth();

    await act(async () => {
      await auth().createGuest();
    });

    expect(mockPost).toHaveBeenCalledWith(UserApis.guest);
    expect(auth().user).toEqual(guest);
  });

  it('converts a guest using the current token and swaps in the new session', async () => {
    const { auth } = await renderSignedIn();
    const converted = { ...USER, is_guest: false };
    mockPost.mockResolvedValue({
      data: { token: 'token-2', refresh_token: 'refresh-2', user: converted },
    });

    await act(async () => {
      await auth().convertGuest('ada@example.com', 'hunter2');
    });

    expect(lastAuthHeader()).toBe('Bearer token-1');
    expect(mockPost).toHaveBeenCalledWith(UserApis.convertGuest, {
      email: 'ada@example.com',
      password: 'hunter2',
    });
    expect(auth().token).toBe('token-2');
    await expect(AsyncStorage.getItem(REFRESH_KEY)).resolves.toBe('refresh-2');
  });
});

describe('password recovery', () => {
  it('requests a reset code without touching the session', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { auth } = await renderAuth();

    await act(async () => {
      await auth().forgotPassword('ada@example.com');
    });

    expect(mockPost).toHaveBeenCalledWith(UserApis.forgotPassword, {
      email: 'ada@example.com',
    });
    expect(auth().token).toBeNull();
  });

  it('signs the user in with the session a successful reset returns', async () => {
    mockPost.mockResolvedValue({
      data: { token: 'token-3', refresh_token: 'refresh-3', user: USER },
    });
    const { auth } = await renderAuth();

    await act(async () => {
      await auth().resetPassword('ada@example.com', '123456', 'newpass');
    });

    expect(mockPost).toHaveBeenCalledWith(UserApis.resetPassword, {
      email: 'ada@example.com',
      code: '123456',
      new_password: 'newpass',
    });
    expect(auth().token).toBe('token-3');
    expect(auth().user).toEqual(USER);
  });
});

describe('email verification', () => {
  it('updates and persists the signed-in user when the server returns one', async () => {
    const { auth } = await renderSignedIn();
    const verified = { ...USER, email_verified: true };
    mockPost.mockResolvedValue({ data: verified });

    await act(async () => {
      await auth().verifyEmail('ada@example.com', '123456');
    });

    expect(mockPost).toHaveBeenCalledWith(UserApis.verifyEmail, {
      email: 'ada@example.com',
      code: '123456',
    });
    expect(auth().user).toEqual(verified);
    await expect(storedUser()).resolves.toEqual(verified);
  });

  it('does not create a session when verifying while signed out', async () => {
    // The verify screen is reachable straight from the signup email, with no
    // session yet; a response body there must not be mistaken for a login.
    mockPost.mockResolvedValue({ data: { ...USER, email_verified: true } });
    const { auth } = await renderAuth();

    await act(async () => {
      await auth().verifyEmail('ada@example.com', '123456');
    });

    expect(auth().user).toBeNull();
    await expect(AsyncStorage.getItem(USER_KEY)).resolves.toBeNull();
  });

  it('resends verification without a session', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const { auth } = await renderAuth();

    await act(async () => {
      await auth().resendVerification('ada@example.com');
    });

    expect(mockPost).toHaveBeenCalledWith(UserApis.resendVerification, {
      email: 'ada@example.com',
    });
  });
});

describe('fetchMe', () => {
  it('refreshes the cached user from the server', async () => {
    const { auth } = await renderSignedIn();
    const updated = { ...USER, name: 'Ada L.' };
    mockGet.mockResolvedValue({ data: updated });

    await act(async () => {
      await auth().fetchMe();
    });

    expect(mockGet).toHaveBeenCalledWith(UserApis.me);
    expect(lastAuthHeader()).toBe('Bearer token-1');
    expect(auth().user).toEqual(updated);
    await expect(storedUser()).resolves.toEqual(updated);
  });
});

describe('refreshSession', () => {
  it('resolves null without calling the server when there is no refresh token', async () => {
    mockPost.mockResolvedValue({ data: { token: 'token-1', user: USER } });
    const { auth } = await renderAuth();
    await act(async () => {
      await auth().login('ada@example.com', 'pw');
    });
    mockPost.mockClear();

    let result: string | null = 'unset';
    await act(async () => {
      result = await auth().refreshSession();
    });

    expect(result).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('rotates both tokens and keeps the existing user when none is returned', async () => {
    const { auth } = await renderSignedIn();
    mockPost.mockResolvedValue({ data: { token: 'token-2', refresh_token: 'refresh-2' } });

    let result: string | null = null;
    await act(async () => {
      result = await auth().refreshSession();
    });

    expect(mockPost).toHaveBeenCalledWith(UserApis.refresh, { refresh_token: 'refresh-1' });
    expect(result).toBe('token-2');
    expect(auth().user).toEqual(USER);
    await expect(AsyncStorage.getItem(TOKEN_KEY)).resolves.toBe('token-2');
    await expect(AsyncStorage.getItem(REFRESH_KEY)).resolves.toBe('refresh-2');
  });

  it('keeps the current refresh token when the server does not rotate it', async () => {
    const { auth } = await renderSignedIn();
    mockPost.mockResolvedValue({ data: { token: 'token-2' } });

    await act(async () => {
      await auth().refreshSession();
    });

    await expect(AsyncStorage.getItem(REFRESH_KEY)).resolves.toBe('refresh-1');
  });
});

describe('logout', () => {
  it('revokes server-side with the bearer token and clears everything', async () => {
    const { auth } = await renderSignedIn();
    mockPost.mockResolvedValue({ data: {} });

    await act(async () => {
      await auth().logout();
    });

    expect(mockPost).toHaveBeenCalledWith(UserApis.logout);
    expect(lastAuthHeader()).toBe('Bearer token-1');
    expect(auth().token).toBeNull();
    expect(auth().user).toBeNull();
    await expect(AsyncStorage.multiGet([TOKEN_KEY, REFRESH_KEY, USER_KEY])).resolves.toEqual([
      [TOKEN_KEY, null],
      [REFRESH_KEY, null],
      [USER_KEY, null],
    ]);
  });

  it('signs out locally even when revocation fails', async () => {
    // Offline sign-out has to work; the local session is what gates the UI.
    const { auth } = await renderSignedIn();
    mockPost.mockRejectedValue(new Error('network down'));

    await act(async () => {
      await auth().logout();
    });

    expect(auth().token).toBeNull();
    await expect(AsyncStorage.getItem(TOKEN_KEY)).resolves.toBeNull();
  });

  it('skips the revoke call when there is no token', async () => {
    const { auth } = await renderAuth();

    await act(async () => {
      await auth().logout();
    });

    expect(mockPost).not.toHaveBeenCalled();
    expect(auth().token).toBeNull();
  });
});

describe('session expiry from the http layer', () => {
  it('drops the in-memory session when the handler fires', async () => {
    const { auth } = await renderSignedIn();
    expect(auth().token).toBe('token-1');

    await act(async () => {
      mockSessionExpired.current?.();
    });

    expect(auth().token).toBeNull();
    expect(auth().user).toBeNull();
  });

  it('unregisters the handler on unmount', async () => {
    const { tree } = await renderAuth();
    expect(mockSessionExpired.current).toBeInstanceOf(Function);

    await act(async () => {
      tree.unmount();
    });

    expect(mockSessionExpired.current).toBeNull();
  });
});
