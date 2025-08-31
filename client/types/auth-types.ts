// auth-types.ts
export type User = {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
};

export type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  updateProfile: (username: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
};
