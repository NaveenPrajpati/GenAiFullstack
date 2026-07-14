import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL, UserApis } from './api';

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

// Called when refresh fails (no/expired refresh token). AuthContext registers
// its sign-out here so a hard 401 clears the in-memory session and redirects.
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(handler: (() => void) | null) {
  onSessionExpired = handler;
}

// Single-flight: many requests can 401 at once, but we only refresh once and
// let them all await the same result.
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    // Bare axios (not `http`) so the request skips our interceptors — otherwise
    // a 401 from /refresh itself would recurse.
    const res = await axios.post(`${BASE_URL}${UserApis.refresh}`, {
      refresh_token: refreshToken,
    });
    const newToken: string = res.data.token;
    const newRefresh: string | undefined = res.data.refresh_token;
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    if (newRefresh) await AsyncStorage.setItem(REFRESH_KEY, newRefresh);
    return newToken;
  } catch {
    // Refresh token is dead — clear the session and notify AuthContext.
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY]);
    onSessionExpired?.();
    return null;
  }
}

/** De-duplicated refresh: concurrent callers share one in-flight refresh. */
export function refreshAuthTokenOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * `fetch` wrapper for the non-axios call sites (RAG streaming/upload). Attaches
 * the bearer token and, on a 401, refreshes the token once and retries — the
 * same behavior the axios interceptor gives the rest of the app.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const withToken = async (token: string | null): Promise<RequestInit> => ({
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let response = await fetch(input, await withToken(await getAuthToken()));
  if (response.status === 401) {
    const newToken = await refreshAuthTokenOnce();
    if (newToken) {
      response = await fetch(input, await withToken(newToken));
    }
  }
  return response;
}

export const http = axios.create({ baseURL: BASE_URL });

http.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    // Retry a 401 exactly once, after refreshing the access token.
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const newToken = await refreshAuthTokenOnce();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return http(original);
      }
    }
    return Promise.reject(error);
  }
);

export default http;
