import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../api/client';

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt?: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref(localStorage.getItem('token') || '');
  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  function setToken(newToken: string) {
    token.value = newToken;
    localStorage.setItem('token', newToken);
  }

  function clearAuth() {
    user.value = null;
    token.value = '';
    localStorage.removeItem('token');
  }

  async function fetchMe() {
    if (!token.value) return;
    try {
      const { data } = await api.get('/auth/me');
      user.value = data;
    } catch {
      clearAuth();
    }
  }

  async function login(username: string, password: string) {
    const { data } = await api.post('/auth/login', { username, password });
    setToken(data.token);
    user.value = data.user;
    return data.user;
  }

  async function register(username: string, password: string) {
    const { data } = await api.post('/auth/register', { username, password });
    setToken(data.token);
    user.value = data.user;
    return data.user;
  }

  async function switchRole() {
    const { data } = await api.post('/auth/switch-role');
    setToken(data.token);
    user.value = data.user;
    return data.role;
  }

  function logout() {
    clearAuth();
  }

  return {
    user,
    token,
    isLoggedIn,
    isAdmin,
    login,
    register,
    logout,
    fetchMe,
    switchRole,
  };
});
