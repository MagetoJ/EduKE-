import React, { useCallback, useEffect, useState } from 'react';

import { AuthContext, type AuthContextType, type User } from './auth-context';

export type { User, UserRole } from './auth-context';

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  
  // Separating app state checking from run-time API processing states
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    setIsInitializing(false);
  }, []);

  const logout = useCallback(() => {
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setToken(null);
    setUserState(null);
    setIsImpersonating(false);
  }, []);

  const impersonate = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUserState(newUser);
    setIsImpersonating(true);
  }, []);

  const exitImpersonation = useCallback(() => {
    logout();
  }, [logout]);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to refresh session');
      }

      const newToken = data.data.accessToken;
      setToken(newToken);
      return newToken as string;
    } catch {
      logout();
      return null;
    }
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string, remember = true) => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || data.message || 'Incorrect email or password.');
        }

        void remember;
        const normalizedUser: User = {
          id: String(data.data.user.id),
          email: data.data.user.email,
          name: data.data.user.name || `${data.data.user.first_name} ${data.data.user.last_name}`,
          role: data.data.user.role,
          roles: Array.isArray(data.data.user.roles) && data.data.user.roles.length > 0 
           ? data.data.user.roles 
           : [data.data.user.role],
          schoolId: data.data.user.school_id ? String(data.data.user.school_id) : undefined,
          schoolName: data.data.user.school_name,
          schoolCurriculum: data.data.user.school_curriculum,
          avatar: data.data.user.avatar,
          must_change_password: data.data.user.must_change_password,
          // Extract specialized configurations for dashboard tailoring
          isSpecialNeeds: !!data.data.user.school_is_special_needs,
          disabilityCategory: data.data.user.school_disability_category || undefined
        };

        setToken(data.data.accessToken);
        setUserState(normalizedUser);

        if (normalizedUser.must_change_password) {
          return 'redirect_change_password';
        }

      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateUser = useCallback(
    (newUser: User | null) => {
      if (!newUser) {
        logout();
        return;
      }

      setUserState(newUser);
    },
    [logout]
  );

  const value: AuthContextType = {
    user,
    setUser: updateUser,
    login,
    logout,
    isLoading,
    token,
    isImpersonating,
    refreshSession,
    impersonate,
    exitImpersonation
  };

  return (
    <AuthContext.Provider value={value}>
      {!isInitializing && children}
    </AuthContext.Provider>
  );
};

export { AuthProvider };