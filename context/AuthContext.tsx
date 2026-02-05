import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  setupUser: (username: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'acestep_token';
const USER_KEY = 'acestep_user';
const DEMO_MODE_KEY = 'acestep_demo_mode';

// Generate a simple demo token
function generateDemoToken(): string {
  return 'demo_' + Math.random().toString(36).substring(2, 15);
}

// Check if backend is available
async function checkBackendAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  // Start with null - we'll auto-login from database on mount
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const isAuthenticated = !!user && !!token;

  // Auto-login on mount: Try to get existing user from database
  useEffect(() => {
    async function initAuth(): Promise<void> {
      // Check if we have demo mode data in localStorage
      const savedDemoMode = localStorage.getItem(DEMO_MODE_KEY);
      const savedUser = localStorage.getItem(USER_KEY);
      const savedToken = localStorage.getItem(TOKEN_KEY);
      
      if (savedDemoMode === 'true' && savedUser && savedToken) {
        // Restore demo session
        try {
          setUser(JSON.parse(savedUser));
          setToken(savedToken);
          setIsDemoMode(true);
          setIsLoading(false);
          return;
        } catch {
          // Invalid saved data, continue with normal flow
        }
      }

      // Check if backend is available
      const backendAvailable = await checkBackendAvailable();
      
      if (!backendAvailable) {
        // Backend not available - enter demo mode if we have saved user
        console.log('Backend not available - demo mode enabled');
        setIsDemoMode(true);
        setIsLoading(false);
        return;
      }

      try {
        // First, try auto-login from database (for local single-user app)
        const { user: userData, token: newToken } = await authApi.auto();
        setUser(userData);
        setToken(newToken);
        setIsDemoMode(false);
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        localStorage.removeItem(DEMO_MODE_KEY);
      } catch (error: unknown) {
        // No user in database (404) or server error - that's okay
        // Clear any stale localStorage data
        const err = error as { message?: string };
        if (err.message?.startsWith('404:')) {
          // No user exists yet - frontend will show username setup
          console.log('No user in database, need to set up username');
        } else {
          console.warn('Auto-login failed:', error);
          // If we get a network error, enable demo mode
          if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
            setIsDemoMode(true);
          }
        }
        // Clear stale data
        setToken(null);
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(DEMO_MODE_KEY);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const setupUser = useCallback(async (username: string): Promise<void> => {
    // If in demo mode, create a local demo user
    if (isDemoMode) {
      const demoUser: User = {
        id: 'demo_' + Math.random().toString(36).substring(2, 9),
        username: username,
        isAdmin: false,
        createdAt: new Date().toISOString(),
      };
      const demoToken = generateDemoToken();
      setUser(demoUser);
      setToken(demoToken);
      localStorage.setItem(TOKEN_KEY, demoToken);
      localStorage.setItem(USER_KEY, JSON.stringify(demoUser));
      localStorage.setItem(DEMO_MODE_KEY, 'true');
      return;
    }

    const { user: userData, token: newToken } = await authApi.setup(username);
    setUser(userData);
    setToken(newToken);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    localStorage.removeItem(DEMO_MODE_KEY);
  }, [isDemoMode]);

  const updateUsername = useCallback(async (username: string): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    const { user: userData, token: newToken } = await authApi.updateUsername(username, token);
    setUser(userData);
    setToken(newToken);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  }, [token]);

  const logout = useCallback((): void => {
    if (!isDemoMode) {
      authApi.logout().catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(DEMO_MODE_KEY);
  }, [isDemoMode]);

  const refreshUser = useCallback(async (): Promise<void> => {
    if (!token) return;
    // Skip refresh in demo mode
    if (isDemoMode) return;
    try {
      const { user: userData } = await authApi.me(token);
      setUser(userData);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [token, isDemoMode]);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    isDemoMode,
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
