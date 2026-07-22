import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'parent' | 'student' | 'registrar' | 'timetable_manager' | 'class_teacher' | 'boarding_master' | 'transport_manager' | 'exam_officer' | 'cbc_coordinator' | 'hod' | 'hr_manager' | 'admission_officer' | 'nurse';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roles: UserRole[];
  schoolId?: string;
  schoolName?: string;
  avatar?: string;
  must_change_password?: boolean;
  // System configurations derived from Option Selected in School Registration
  isSpecialNeeds?: boolean;
  disabilityCategory?: 'hearing_impaired' | 'visual_impaired' | 'physical_mobility';
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string, remember?: boolean) => Promise<string | void>;
  logout: () => void;
  isLoading: boolean;
  token: string | null;
  refreshToken: string | null;
  isImpersonating: boolean;
  refreshSession: () => Promise<string | null>;
  impersonate: (token: string, user: User) => void;
  exitImpersonation: () => void;
}

type StorageType = 'local' | 'session';

type StoredItem = {
  value: string | null;
  storage: StorageType;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getStoredItem = (key: string): StoredItem => {
  if (typeof window === 'undefined') {
    return { value: null, storage: 'local' };
  }

  const localValue = window.localStorage.getItem(key);
  if (localValue) {
    return { value: localValue, storage: 'local' };
  }

  const sessionValue = window.sessionStorage.getItem(key);
  if (sessionValue) {
    return { value: sessionValue, storage: 'session' };
  }

  return { value: null, storage: 'local' };
};

const clearAuthStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem('token');
  window.localStorage.removeItem('refreshToken');
  window.localStorage.removeItem('user');
  window.localStorage.removeItem('authStoragePreference');
  window.sessionStorage.removeItem('token');
  window.sessionStorage.removeItem('refreshToken');
  window.sessionStorage.removeItem('user');
};

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const initialToken = getStoredItem('token');
  const initialRefreshToken = getStoredItem('refreshToken');
  const initialUser = getStoredItem('user');
  const initialOriginalToken = getStoredItem('originalToken');

  const initialStoragePreference: StorageType = initialToken.value
    ? initialToken.storage
    : initialRefreshToken.value
      ? initialRefreshToken.storage
      : initialUser.storage;

  const [user, setUserState] = useState<User | null>(() => {
    if (!initialUser.value) {
      return null;
    }

    try {
      const parsed = JSON.parse(initialUser.value) as User;
      return parsed;
    } catch (error) {
      console.error('Failed to parse stored user', error);
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(initialToken.value);
  const [refreshToken, setRefreshToken] = useState<string | null>(initialRefreshToken.value);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(!!initialOriginalToken.value);
  
  // Separating app state checking from run-time API processing states
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const [storagePreference, setStoragePreference] = useState<StorageType>(initialStoragePreference);

  const storagePreferenceRef = useRef<StorageType>(initialStoragePreference);
  const userRef = useRef<User | null>(user);

  useEffect(() => {
    storagePreferenceRef.current = storagePreference;
  }, [storagePreference]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    setIsInitializing(false);
  }, []);

  const writeAuthToStorage = useCallback(
    (storageType: StorageType, tokenValue: string | null, refreshValue: string | null, userValue: User | null) => {
      if (typeof window === 'undefined') {
        return;
      }

      const primary = storageType === 'local' ? window.localStorage : window.sessionStorage;
      const secondary = storageType === 'local' ? window.sessionStorage : window.localStorage;

      if (tokenValue) {
        primary.setItem('token', tokenValue);
      } else {
        primary.removeItem('token');
      }
      secondary.removeItem('token');

      if (refreshValue) {
        primary.setItem('refreshToken', refreshValue);
      } else {
        primary.removeItem('refreshToken');
      }
      secondary.removeItem('refreshToken');

      if (userValue) {
        primary.setItem('user', JSON.stringify(userValue));
      } else {
        primary.removeItem('user');
      }
      secondary.removeItem('user');

      window.localStorage.setItem('authStoragePreference', storageType);
    },
    []
  );

  const logout = useCallback(() => {
    clearAuthStorage();
    window.localStorage.removeItem('originalToken');
    window.localStorage.removeItem('originalUser');
    window.sessionStorage.removeItem('originalToken');
    window.sessionStorage.removeItem('originalUser');
    setToken(null);
    setRefreshToken(null);
    setUserState(null);
    setIsImpersonating(false);
  }, []);

  const impersonate = useCallback((newToken: string, newUser: User) => {
    const storage = storagePreferenceRef.current === 'local' ? window.localStorage : window.sessionStorage;
    
    storage.setItem('originalToken', token || '');
    storage.setItem('originalUser', JSON.stringify(user));
    
    setToken(newToken);
    setUserState(newUser);
    setIsImpersonating(true);
    
    storage.setItem('token', newToken);
    storage.setItem('user', JSON.stringify(newUser));
  }, [token, user]);

  const exitImpersonation = useCallback(() => {
    const storage = storagePreferenceRef.current === 'local' ? window.localStorage : window.sessionStorage;
    
    const originalToken = storage.getItem('originalToken');
    const originalUserJson = storage.getItem('originalUser');
    
    if (originalToken && originalUserJson) {
      const originalUser = JSON.parse(originalUserJson);
      
      setToken(originalToken);
      setUserState(originalUser);
      setIsImpersonating(false);
      
      storage.setItem('token', originalToken);
      storage.setItem('user', originalUserJson);
      
      storage.removeItem('originalToken');
      storage.removeItem('originalUser');
    } else {
      logout();
    }
  }, [logout]);

  const refreshSession = useCallback(async () => {
    if (!refreshToken) {
      logout();
      return null;
    }

    try {
      const response = await fetch(`/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ refreshToken })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to refresh session');
      }

      const newToken = data.data.accessToken;
      setToken(newToken);
      writeAuthToStorage(storagePreferenceRef.current, newToken, refreshToken, userRef.current);
      return newToken as string;
    } catch {
      logout();
      return null;
    }
  }, [logout, refreshToken, writeAuthToStorage]);

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

        const storageType: StorageType = remember ? 'local' : 'session';
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
          avatar: data.data.user.avatar,
          must_change_password: data.data.user.must_change_password,
          // Extract specialized configurations for dashboard tailoring
          isSpecialNeeds: !!data.data.user.school_is_special_needs,
          disabilityCategory: data.data.user.school_disability_category || undefined
        };

        setStoragePreference(storageType);
        setToken(data.data.accessToken);
        setRefreshToken('stored-in-cookie');
        setUserState(normalizedUser);
        writeAuthToStorage(storageType, data.data.accessToken, 'stored-in-cookie', normalizedUser);

        if (normalizedUser.must_change_password) {
          return 'redirect_change_password';
        }

      } finally {
        setIsLoading(false);
      }
    },
    [writeAuthToStorage]
  );

  const updateUser = useCallback(
    (newUser: User | null) => {
      if (!newUser) {
        logout();
        return;
      }

      setUserState(newUser);
      writeAuthToStorage(storagePreferenceRef.current, token, refreshToken, newUser);
    },
    [logout, refreshToken, token, writeAuthToStorage]
  );

  const value: AuthContextType = {
    user,
    setUser: updateUser,
    login,
    logout,
    isLoading,
    token,
    refreshToken,
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

export function useApi() {
  const { token, logout, refreshSession } = useAuth();

  const authenticatedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const executeRequest = async (overrideToken?: string) => {
        const headers = new Headers(options.headers || {});
        const authToken = overrideToken ?? token;
        if (authToken) {
          headers.set('Authorization', `Bearer ${authToken}`);
        }
        if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
          headers.set('Content-Type', 'application/json');
        }
        return fetch(url, { ...options, headers });
      };

      let response = await executeRequest();

      if (response.status === 401) {
        const newToken = await refreshSession();
        if (!newToken) {
          logout();
          throw new Error('Your session has expired. Please log in again.');
        }
        response = await executeRequest(newToken);
        if (response.status === 401) {
          logout();
          throw new Error('Your session has expired. Please log in again.');
        }
      }

      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.detail || `Request failed with status ${response.status}`);
        } catch (err) {
          if (err instanceof Error) throw err;
          throw new Error(`Server execution encountered an update status: ${response.status}`);
        }
      }

      return response;
    },
    [logout, refreshSession, token]
  );

  return authenticatedFetch;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthProvider };