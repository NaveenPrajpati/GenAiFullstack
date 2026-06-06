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
  expires_at: string | null;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  createGuest: () => Promise<void>;
  convertGuest: (email: string, password: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
}

const TOKEN_KEY = 'auth_token';
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
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Rehydrate persisted session on mount
  useEffect(() => {
    const init = async () => {
      try {
        const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
        const savedUser = await AsyncStorage.getItem(USER_KEY);
        if (savedToken && savedUser) {
          setToken(savedToken);
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

  const saveSession = async (t: string, u: User) => {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, t],
      [USER_KEY, JSON.stringify(u)],
    ]);
    setToken(t);
    setUser(u);
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient().post(UserApis.login, { email, password });
    await saveSession(res.data.token, res.data.user);
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const res = await apiClient().post(UserApis.signup, { email, password });
    await saveSession(res.data.token, res.data.user);
  }, []);

  const createGuest = useCallback(async () => {
    const res = await apiClient().post(UserApis.guest);
    await saveSession(res.data.token, res.data.user);
  }, []);

  const convertGuest = useCallback(
    async (email: string, password: string) => {
      const res = await apiClient(token).post(UserApis.convertGuest, { email, password });
      await saveSession(res.data.token, res.data.user);
    },
    [token]
  );

  const fetchMe = useCallback(async () => {
    const res = await apiClient(token).get(UserApis.me);
    const updated: User = res.data;
    setUser(updated);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
  }, [token]);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, user, isReady, login, signup, createGuest, convertGuest, fetchMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
