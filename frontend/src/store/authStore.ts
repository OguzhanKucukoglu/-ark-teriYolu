import { create } from 'zustand';
import { User } from '../types';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user:            JSON.parse(localStorage.getItem('avatar_user') || 'null'),
  token:           localStorage.getItem('avatar_token'),
  isAuthenticated: !!localStorage.getItem('avatar_token'),

  setAuth: (user, token) => {
    localStorage.setItem('avatar_token', token);
    localStorage.setItem('avatar_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('avatar_token');
    localStorage.removeItem('avatar_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
