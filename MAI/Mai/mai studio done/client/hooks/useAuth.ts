import { useContext, useCallback, useState, useEffect } from 'react';
import { AuthContext } from '@/lib/authContext';
import { User, LoginRequest, SignUpRequest, CreateProfileRequest } from '@shared/api';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const useAuthApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = useCallback(async (data: SignUpRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Signup failed');
      }
      return result.user as User;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Signup failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Login failed');
      }
      return result.user as User;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Login failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProfile = useCallback(async (data: CreateProfileRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Profile creation failed');
      }
      return result.user as User;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Profile creation failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
      });
      const result = await response.json();
      return result;
    } catch (err) {
      console.error('Session fetch error:', err);
      return { user: null, authenticated: false };
    }
  }, []);

  return {
    signup,
    login,
    logout,
    createProfile,
    getSession,
    isLoading,
    error,
  };
};
