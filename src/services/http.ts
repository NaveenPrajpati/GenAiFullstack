import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from './api';

// Mirrors the key AuthContext persists the session token under.
const TOKEN_KEY = 'auth_token';

/** Reads the persisted bearer token, or null if the user isn't signed in. */
export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

/**
 * Shared axios instance. A request interceptor attaches the persisted
 * `Authorization: Bearer <token>` header to every call, so callers never have
 * to thread the token through manually.
 *
 * For `fetch`-based calls (streaming, multipart uploads) that can't use this
 * instance, grab the header from `getAuthToken()` instead.
 */

export const http = axios.create({ baseURL: BASE_URL });

http.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default http;
