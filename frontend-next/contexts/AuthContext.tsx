"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api';

export interface Role {
  id: string;
  name: string;
  is_system: boolean;
  permissions: string[];
}

export interface User {
  id: string;
  username: string;
  name: string;
  is_active: boolean;
  roles: Role[];
  permissions: string[];
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('academy_token');
      if (token) {
        try {
          const currentUser = await apiClient.getCurrentUser();
          setUser(currentUser);
        } catch (error) {
          // Token is invalid, clear it
          apiClient.setToken(null);
          localStorage.removeItem('academy_user');
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const response = await apiClient.login(username, password);
      setUser(response.user);
      localStorage.setItem('academy_user', JSON.stringify(response.user));
      return { success: true };
    } catch (error: any) {
      // Extract error message properly
      let errorMessage = 'Invalid username or password';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = String(error.message);
      } else if (error?.detail) {
        errorMessage = String(error.detail);
      }
      return { success: false, error: errorMessage };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    apiClient.setToken(null);
    localStorage.removeItem('academy_user');
  }, []);

  const hasPermission = useCallback(
    (permission: string) => !!user?.permissions?.includes(permission),
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
