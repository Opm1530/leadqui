import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api from "@/lib/api";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "OPERATOR" | "CLIENT";
  position?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Ao montar, verificar se há token salvo e validar com o servidor
  useEffect(() => {
    const token = localStorage.getItem("pequi_token");
    if (!token) {
      setLoading(false);
      return;
    }

    api.get("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem("pequi_token");
        localStorage.removeItem("pequi_user");
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthUser> => {
    const data = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("pequi_token", data.token);
    localStorage.setItem("pequi_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const signOut = () => {
    localStorage.removeItem("pequi_token");
    localStorage.removeItem("pequi_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
