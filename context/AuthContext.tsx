import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi, User, isBackendAvailable, checkBackendAvailability } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  backendAvailable: boolean;
  setupUser: (username: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'acestep_token';
const USER_KEY = 'acestep_user';

// Generate a simple local token for offline mode
function generateLocalToken(userId: string, username: string): string {
  return btoa(JSON.stringify({ id: userId, username, local: true, ts: Date.now() }));
}

// Generate a UUID-like ID for local users
function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'local-' + crypto.randomUUID();
  }
  return 'local-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);

  const isAuthenticated = !!user && !!token;

  // Auto-login on mount: Try backend first, then fall back to localStorage
  useEffect(() => {
    async function initAuth(): Promise<void> {
      // First check if backend is available
      const hasBackend = await checkBackendAvailability();
      setBackendAvailable(hasBackend);

      if (hasBackend) {
        // Backend available - try to auto-login from database
        try {
          const { user: userData, token: newToken } = await authApi.auto();
          setUser(userData);
          setToken(newToken);
          localStorage.setItem(TOKEN_KEY, newToken);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
        } catch (error: unknown) {
          const err = error as { message?: string };
          if (err.message?.startsWith('404:')) {
            console.log('No user in database, need to set up username');
          } else {
            console.warn('Auto-login failed:', error);
          }
          // Try localStorage fallback even when backend is available
          const savedUser = localStorage.getItem(USER_KEY);
          const savedToken = localStorage.getItem(TOKEN_KEY);
          if (savedUser && savedToken) {
            try {
              setUser(JSON.parse(savedUser));
              setToken(savedToken);
            } catch {
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
            }
          }
        }
      } else {
        // No backend - use localStorage-only mode
        console.log('Backend not available, using local-only mode');
        const savedUser = localStorage.getItem(USER_KEY);
        const savedToken = localStorage.getItem(TOKEN_KEY);
        if (savedUser && savedToken) {
          try {
            setUser(JSON.parse(savedUser));
            setToken(savedToken);
          } catch {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
          }
        }
      }

      setIsLoading(false);
    }

    initAuth();
  }, []);

  const setupUser = useCallback(async (username: string): Promise<void> => {
    if (isBackendAvailable()) {
      // Backend available - create user on server
      try {
        const { user: userData, token: newToken } = await authApi.setup(username);
        setUser(userData);
        setToken(newToken);
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        return;
      } catch (error) {
        console.warn('Backend setup failed, falling back to local mode:', error);
      }
    }

    // Local-only mode: create user in localStorage
    const localId = generateLocalId();
    const localUser: User = {
      id: localId,
      username,
      createdAt: new Date().toISOString(),
    };
    const localToken = generateLocalToken(localId, username);
    setUser(localUser);
    setToken(localToken);
    localStorage.setItem(TOKEN_KEY, localToken);
    localStorage.setItem(USER_KEY, JSON.stringify(localUser));
  }, []);

  const updateUsername = useCallback(async (username: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');

    if (isBackendAvailable()) {
      try {
        const { user: userData, token: newToken } = await authApi.updateUsername(username, token);
        setUser(userData);
        setToken(newToken);
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        return;
      } catch (error) {
        console.warn('Backend update failed, falling back to local mode:', error);
      }
    }

    // Local-only mode: update username in localStorage
    if (user) {
      const updatedUser = { ...user, username };
      const newToken = generateLocalToken(user.id, username);
      setUser(updatedUser);
      setToken(newToken);
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
  }, [token, user]);

  const logout = useCallback((): void => {
    if (isBackendAvailable()) {
      authApi.logout().catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    if (!token) return;
    if (!isBackendAvailable()) return; // Nothing to refresh in local mode
    try {
      const { user: userData } = await authApi.me(token);
      setUser(userData);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [token]);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    backendAvailable,
    setupUser,
    updateUsername,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
