import { BASE_URL, UserApis } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface User {
  id?: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  role: string;
  description: string | null;
  is_guest: boolean;
  email_verified?: boolean;
  expires_at: string | null;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, name: string, password: string) => Promise<void>;
  createGuest: () => Promise<void>;
  convertGuest: (email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

const AuthContext = createContext<AuthContextType | null>(null);

export function apiClient(token?: string | null) {
  return axios.create({
    baseURL: BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Rehydrate persisted session on mount
  useEffect(() => {
    const init = async () => {
      try {
        const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
        const savedRefresh = await AsyncStorage.getItem(REFRESH_KEY);
        const savedUser = await AsyncStorage.getItem(USER_KEY);
        if (savedToken && savedUser) {
          setToken(savedToken);
          setRefreshToken(savedRefresh);
          setUser(JSON.parse(savedUser));
        }
      } catch (e) {
        console.warn('Failed to restore session:', e);
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, []);

  const saveSession = async (t: string, u: User, refresh?: string | null) => {
    const entries: [string, string][] = [
      [TOKEN_KEY, t],
      [USER_KEY, JSON.stringify(u)],
    ];
    if (refresh) entries.push([REFRESH_KEY, refresh]);
    await AsyncStorage.multiSet(entries);
    setToken(t);
    if (refresh) setRefreshToken(refresh);
    setUser(u);
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient().post(UserApis.login, { email, password });
    await saveSession(res.data.token, res.data.user, res.data.refresh_token);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await apiClient().post(UserApis.signup, { email, password, name });
    await saveSession(res.data.token, res.data.user, res.data.refresh_token);
  }, []);

  const createGuest = useCallback(async () => {
    const res = await apiClient().post(UserApis.guest);
    await saveSession(res.data.token, res.data.user, res.data.refresh_token);
  }, []);

  const convertGuest = useCallback(
    async (email: string, password: string) => {
      const res = await apiClient(token).post(UserApis.convertGuest, { email, password });
      await saveSession(res.data.token, res.data.user, res.data.refresh_token);
    },
    [token]
  );

  const forgotPassword = useCallback(async (email: string) => {
    await apiClient().post(UserApis.forgotPassword, { email });
  }, []);

  const resetPassword = useCallback(
    async (email: string, code: string, newPassword: string) => {
      // Backend resets by emailed 6-digit code, returning a fresh session.
      const res = await apiClient().post(UserApis.resetPassword, {
        email,
        code,
        new_password: newPassword,
      });
      await saveSession(res.data.token, res.data.user, res.data.refresh_token);
    },
    []
  );

  const verifyEmail = useCallback(
    async (email: string, code: string) => {
      const res = await apiClient(token).post(UserApis.verifyEmail, { email, code });
      // Reflect the new verified status if this is the signed-in account.
      if (token && res.data?.id) {
        setUser(res.data);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data));
      }
    },
    [token]
  );

  const resendVerification = useCallback(async (email: string) => {
    await apiClient().post(UserApis.resendVerification, { email });
  }, []);

  const fetchMe = useCallback(async () => {
    const res = await apiClient(token).get(UserApis.me);
    const updated: User = res.data;
    setUser(updated);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
  }, [token]);

  const refreshSession = useCallback(async () => {
    if (!refreshToken) return null;
    const res = await apiClient().post(UserApis.refresh, { refresh_token: refreshToken });
    const newToken: string = res.data.token;
    const newRefresh: string | undefined = res.data.refresh_token;
    // Persist the rotated token(s); reuse existing user if none returned.
    await saveSession(newToken, res.data.user ?? user, newRefresh ?? refreshToken);
    return newToken;
  }, [refreshToken, user]);

  const logout = useCallback(async () => {
    // Best-effort server-side revocation (invalidates all tokens); always clear
    // local session even if the call fails or there's no network.
    try {
      if (token) await apiClient(token).post(UserApis.logout);
    } catch {
      // ignore — local sign-out below is what matters to the user
    }
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY]);
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isReady,
        login,
        signup,
        createGuest,
        convertGuest,
        forgotPassword,
        resetPassword,
        verifyEmail,
        resendVerification,
        fetchMe,
        refreshSession,
        logout,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
