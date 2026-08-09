/**
 * The token layer: what gets attached to a request, and what happens on a 401.
 *
 * `http.ts` keeps module-level state (the single-flight `refreshPromise` and the
 * session-expired handler), so every test loads it into a fresh module registry
 * via `loadHttp()` rather than sharing one instance. AsyncStorage and axios are
 * pulled from that same registry — requiring them at the top of the file would
 * hand back a *different* copy than the one the module under test closed over.
 *
 * Requests are driven through the real axios instance with a stubbed adapter, so
 * the interceptors under test run exactly as they do in the app.
 */
import { BASE_URL, UserApis } from '../api';

type HttpModule = typeof import('../http');
type Storage = typeof import('@react-native-async-storage/async-storage').default;

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

/** An axios rejection shaped the way the response interceptor reads it. */
function axiosError(status: number, config: any) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    config,
    response: { status, data: {}, headers: {}, config },
  });
}

function okResponse(config: any, data: any = {}) {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function loadHttp() {
  let http!: HttpModule;
  let axios!: any;
  let storage!: Storage;
  jest.isolateModules(() => {
    axios = require('axios').default;
    storage = require('@react-native-async-storage/async-storage').default;
    http = require('../http');
  });
  return { http, axios, storage };
}

describe('http auth layer', () => {
  let http: HttpModule;
  let axios: any;
  let storage: Storage;
  /** Stands in for the network for requests made through the `http` instance. */
  let adapter: jest.Mock;

  beforeEach(() => {
    ({ http, axios, storage } = loadHttp());
    adapter = jest.fn((config) => Promise.resolve(okResponse(config)));
    http.http.defaults.adapter = adapter as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAuthToken', () => {
    it('reads the persisted access token', async () => {
      await storage.setItem(TOKEN_KEY, 'stored-token');
      await expect(http.getAuthToken()).resolves.toBe('stored-token');
    });

    it('resolves null when nothing is stored', async () => {
      await expect(http.getAuthToken()).resolves.toBeNull();
    });
  });

  describe('request interceptor', () => {
    it('attaches the stored token as a bearer credential', async () => {
      await storage.setItem(TOKEN_KEY, 'abc123');

      await http.http.get('/anything');

      expect(adapter.mock.calls[0][0].headers.Authorization).toBe('Bearer abc123');
    });

    it('sends no Authorization header when signed out', async () => {
      await http.http.get('/anything');

      expect(adapter.mock.calls[0][0].headers.Authorization).toBeUndefined();
    });

    it('uses the configured base URL', () => {
      expect(http.http.defaults.baseURL).toBe(BASE_URL);
    });
  });

  describe('refreshAccessToken', () => {
    it('does not call the network when there is no refresh token', async () => {
      const post = jest.spyOn(axios, 'post');

      await expect(http.refreshAccessToken()).resolves.toBeNull();
      expect(post).not.toHaveBeenCalled();
    });

    it('posts the refresh token and persists the rotated pair', async () => {
      await storage.setItem(REFRESH_KEY, 'refresh-1');
      const post = jest
        .spyOn(axios, 'post')
        .mockResolvedValue({ data: { token: 'token-2', refresh_token: 'refresh-2' } } as any);

      await expect(http.refreshAccessToken()).resolves.toBe('token-2');

      expect(post).toHaveBeenCalledWith(`${BASE_URL}${UserApis.refresh}`, {
        refresh_token: 'refresh-1',
      });
      await expect(storage.getItem(TOKEN_KEY)).resolves.toBe('token-2');
      await expect(storage.getItem(REFRESH_KEY)).resolves.toBe('refresh-2');
    });

    it('keeps the existing refresh token when the server does not rotate it', async () => {
      await storage.setItem(REFRESH_KEY, 'refresh-1');
      jest.spyOn(axios, 'post').mockResolvedValue({ data: { token: 'token-2' } } as any);

      await expect(http.refreshAccessToken()).resolves.toBe('token-2');

      await expect(storage.getItem(REFRESH_KEY)).resolves.toBe('refresh-1');
    });

    it('clears the whole session and notifies the app when refresh is rejected', async () => {
      await storage.multiSet([
        [TOKEN_KEY, 'token-1'],
        [REFRESH_KEY, 'refresh-dead'],
        [USER_KEY, '{"email":"a@b.c"}'],
      ]);
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError(401, {}));
      const onExpired = jest.fn();
      http.setOnSessionExpired(onExpired);

      await expect(http.refreshAccessToken()).resolves.toBeNull();

      expect(onExpired).toHaveBeenCalledTimes(1);
      await expect(storage.multiGet([TOKEN_KEY, REFRESH_KEY, USER_KEY])).resolves.toEqual([
        [TOKEN_KEY, null],
        [REFRESH_KEY, null],
        [USER_KEY, null],
      ]);
    });

    it('does not call a handler that has been unregistered', async () => {
      await storage.setItem(REFRESH_KEY, 'refresh-dead');
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError(401, {}));
      const onExpired = jest.fn();
      http.setOnSessionExpired(onExpired);
      http.setOnSessionExpired(null);

      await http.refreshAccessToken();

      expect(onExpired).not.toHaveBeenCalled();
    });
  });

  describe('refreshAuthTokenOnce', () => {
    it('refreshes once for concurrent callers and gives them all the same token', async () => {
      await storage.setItem(REFRESH_KEY, 'refresh-1');
      const post = jest
        .spyOn(axios, 'post')
        .mockResolvedValue({ data: { token: 'token-2' } } as any);

      const results = await Promise.all([
        http.refreshAuthTokenOnce(),
        http.refreshAuthTokenOnce(),
        http.refreshAuthTokenOnce(),
      ]);

      expect(post).toHaveBeenCalledTimes(1);
      expect(results).toEqual(['token-2', 'token-2', 'token-2']);
    });

    it('starts a fresh refresh once the in-flight one has settled', async () => {
      await storage.setItem(REFRESH_KEY, 'refresh-1');
      const post = jest
        .spyOn(axios, 'post')
        .mockResolvedValue({ data: { token: 'token-2' } } as any);

      await http.refreshAuthTokenOnce();
      await http.refreshAuthTokenOnce();

      expect(post).toHaveBeenCalledTimes(2);
    });

    it('releases the in-flight slot even when the refresh fails', async () => {
      await storage.setItem(REFRESH_KEY, 'refresh-dead');
      const post = jest.spyOn(axios, 'post').mockRejectedValue(axiosError(401, {}));

      await expect(http.refreshAuthTokenOnce()).resolves.toBeNull();
      // A second attempt must not be permanently blocked by the first failure.
      await storage.setItem(REFRESH_KEY, 'refresh-dead');
      await expect(http.refreshAuthTokenOnce()).resolves.toBeNull();

      expect(post).toHaveBeenCalledTimes(2);
    });
  });

  describe('response interceptor', () => {
    it('retries a 401 once with the refreshed token', async () => {
      await storage.multiSet([
        [TOKEN_KEY, 'token-1'],
        [REFRESH_KEY, 'refresh-1'],
      ]);
      jest.spyOn(axios, 'post').mockResolvedValue({ data: { token: 'token-2' } } as any);
      // The retry replays the *same* config object, so the header has to be read
      // as each attempt goes out — by the end both calls point at one reference.
      const sent: string[] = [];
      adapter.mockImplementation((config) => {
        sent.push(config.headers.Authorization);
        return sent.length === 1
          ? Promise.reject(axiosError(401, config))
          : Promise.resolve(okResponse(config, { ok: true }));
      });

      const res = await http.http.get('/protected');

      expect(res.data).toEqual({ ok: true });
      expect(adapter).toHaveBeenCalledTimes(2);
      expect(sent).toEqual(['Bearer token-1', 'Bearer token-2']);
    });

    it('gives up after one retry rather than looping on a persistent 401', async () => {
      await storage.setItem(REFRESH_KEY, 'refresh-1');
      jest.spyOn(axios, 'post').mockResolvedValue({ data: { token: 'token-2' } } as any);
      adapter.mockImplementation((config) => Promise.reject(axiosError(401, config)));

      await expect(http.http.get('/protected')).rejects.toMatchObject({
        response: { status: 401 },
      });

      expect(adapter).toHaveBeenCalledTimes(2);
    });

    it('propagates the 401 without retrying when there is no refresh token', async () => {
      adapter.mockImplementation((config) => Promise.reject(axiosError(401, config)));

      await expect(http.http.get('/protected')).rejects.toMatchObject({
        response: { status: 401 },
      });

      expect(adapter).toHaveBeenCalledTimes(1);
    });

    it('leaves non-401 failures alone', async () => {
      await storage.setItem(REFRESH_KEY, 'refresh-1');
      const post = jest.spyOn(axios, 'post');
      adapter.mockImplementation((config) => Promise.reject(axiosError(500, config)));

      await expect(http.http.get('/boom')).rejects.toMatchObject({ response: { status: 500 } });

      expect(adapter).toHaveBeenCalledTimes(1);
      expect(post).not.toHaveBeenCalled();
    });

    it('refreshes only once when several requests 401 together', async () => {
      await storage.setItem(REFRESH_KEY, 'refresh-1');
      const post = jest
        .spyOn(axios, 'post')
        .mockResolvedValue({ data: { token: 'token-2' } } as any);
      const seen = new Set<string>();
      adapter.mockImplementation((config) => {
        // Fail each URL once, then succeed — mirroring a batch of stale-token calls.
        if (seen.has(config.url)) return Promise.resolve(okResponse(config, { ok: true }));
        seen.add(config.url);
        return Promise.reject(axiosError(401, config));
      });

      await Promise.all([http.http.get('/a'), http.http.get('/b'), http.http.get('/c')]);

      expect(post).toHaveBeenCalledTimes(1);
    });
  });

  describe('authedFetch', () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
      fetchMock = jest.fn().mockResolvedValue({ status: 200 });
      globalThis.fetch = fetchMock as any;
    });

    it('attaches the bearer token while preserving the caller’s init', async () => {
      await storage.setItem(TOKEN_KEY, 'token-1');

      await http.authedFetch('https://api.test/upload', {
        method: 'POST',
        body: 'payload',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(fetchMock).toHaveBeenCalledWith('https://api.test/upload', {
        method: 'POST',
        body: 'payload',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-1',
        },
      });
    });

    it('omits the Authorization header when signed out', async () => {
      await http.authedFetch('https://api.test/thing');

      expect(fetchMock.mock.calls[0][1].headers).toEqual({});
    });

    it('refreshes and replays the request on a 401', async () => {
      await storage.multiSet([
        [TOKEN_KEY, 'token-1'],
        [REFRESH_KEY, 'refresh-1'],
      ]);
      jest.spyOn(axios, 'post').mockResolvedValue({ data: { token: 'token-2' } } as any);
      const retried = { status: 200 };
      fetchMock.mockResolvedValueOnce({ status: 401 }).mockResolvedValueOnce(retried);

      const res = await http.authedFetch('https://api.test/stream');

      expect(res).toBe(retried);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-2');
    });

    it('returns the 401 untouched when the refresh fails', async () => {
      await storage.setItem(REFRESH_KEY, 'refresh-dead');
      jest.spyOn(axios, 'post').mockRejectedValue(axiosError(401, {}));
      const unauthorized = { status: 401 };
      fetchMock.mockResolvedValue(unauthorized);

      const res = await http.authedFetch('https://api.test/stream');

      expect(res).toBe(unauthorized);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry a non-401 failure', async () => {
      await storage.setItem(REFRESH_KEY, 'refresh-1');
      const post = jest.spyOn(axios, 'post');
      fetchMock.mockResolvedValue({ status: 500 });

      const res = await http.authedFetch('https://api.test/stream');

      expect(res.status).toBe(500);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(post).not.toHaveBeenCalled();
    });
  });
});
