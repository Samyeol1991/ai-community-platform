import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, type AuthResponse } from "./api";

interface AuthContextType {
  user: AuthResponse | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; nickname: string; email: string; password: string; ageGroup: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<AuthResponse>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.auth.getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const user = await api.auth.login({ email, password });
    setUser(user);
  };

  const register = async (data: { name: string; nickname: string; email: string; password: string; ageGroup: string }) => {
    const user = await api.auth.register(data);
    setUser(user);
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  const updateUser = (updatedUser: Partial<AuthResponse>) => {
    setUser(prev => prev ? { ...prev, ...updatedUser } : null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
