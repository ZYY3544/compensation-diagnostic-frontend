/**
 * AuthContext：用户登录状态全局管理。
 * - mount 时如果有 token，自动 fetchMe 验证
 * - login/register 成功后保存 token + user + workspace
 * - logout 清空一切
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { setToken, getToken, fetchMe, loginApi, registerApi } from '../api/client';

export interface User {
  id: string;
  email: string;
  display_name?: string | null;
}
export interface Workspace {
  id: string;
  name: string;
  company_name?: string | null;
}

interface AuthState {
  user: User | null;
  workspace: Workspace | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; display_name?: string; company_name?: string }) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  // mount: 有 token 就 verify
  useEffect(() => {
    const t = getToken();
    if (!t) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(res => {
        setUser(res.data.user);
        setWorkspace(res.data.workspace);
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await loginApi({ email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    setWorkspace(res.data.workspace);
  };

  const register = async (data: Parameters<AuthState['register']>[0]) => {
    const res = await registerApi(data);
    setToken(res.data.token);
    setUser(res.data.user);
    setWorkspace(res.data.workspace);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setWorkspace(null);
    window.location.href = '/login';
  };

  return (
    <AuthCtx.Provider value={{ user, workspace, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
