import { create } from 'zustand';
import { apiRequest, configureApiClient } from '../services/apiClient';
import { initializeSodium, generateKeyPair, decryptGroupKey, serializeKey, deserializeKey } from '../services/encryptionService';

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  groupKey: Uint8Array | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, inviteToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

const useAuthStore = create<AuthState>((set, get) => {
  // Configure the API client to integrate with this store
  configureApiClient({
    getAccessToken: () => get().accessToken,
    getRefreshToken: () => get().refreshToken,
    onTokensRefreshed: async (accessToken, refreshToken) => {
      set({ accessToken, refreshToken });
      try {
        await window.api.secureStorage.set('accessToken', accessToken);
        await window.api.secureStorage.set('refreshToken', refreshToken);
      } catch {
        // safeStorage may not be available in all environments
      }
    },
    onSessionExpired: async () => {
      set({ user: null, accessToken: null, refreshToken: null, groupKey: null, error: null });
      try {
        await window.api.secureStorage.delete('accessToken');
        await window.api.secureStorage.delete('refreshToken');
      } catch {
        // safeStorage may not be available
      }
    },
  });

  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    groupKey: null,
    isLoading: true,
    error: null,

    login: async (username: string, password: string) => {
      set({ isLoading: true, error: null });
      try {
        const data = await apiRequest<{
          accessToken: string;
          refreshToken: string;
          user: User;
          encryptedGroupKey: string | null;
        }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });

        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isLoading: false,
          error: null,
        });

        // Persist tokens to safeStorage
        try {
          await window.api.secureStorage.set('accessToken', data.accessToken);
          await window.api.secureStorage.set('refreshToken', data.refreshToken);
        } catch {
          // safeStorage may not be available
        }

        // Decrypt group key if available
        if (data.encryptedGroupKey) {
          try {
            await initializeSodium();
            const privateKeyB64 = await window.api.secureStorage.get('private-key');
            const publicKeyB64 = await window.api.secureStorage.get('public-key');
            if (privateKeyB64 && publicKeyB64) {
              const privateKey = deserializeKey(privateKeyB64);
              const publicKey = deserializeKey(publicKeyB64);
              const groupKey = decryptGroupKey(data.encryptedGroupKey, publicKey, privateKey);
              set({ groupKey });
            }
            // Store encrypted group key for session restoration
            await window.api.secureStorage.set('encrypted-group-key', data.encryptedGroupKey);
          } catch {
            // Encryption keys not available — user may need to re-register
          }
        }
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        let message = 'Login failed. Please try again.';
        if (error.code === 'INVALID_CREDENTIALS') {
          message = 'Invalid username or password.';
        } else if (error.code === 'ACCOUNT_BANNED') {
          message = 'Your account has been banned.';
        }
        set({ isLoading: false, error: message });
      }
    },

    register: async (username: string, password: string, inviteToken: string) => {
      set({ isLoading: true, error: null });
      try {
        await initializeSodium();
        const { publicKey, secretKey } = generateKeyPair();

        const data = await apiRequest<{
          user: User;
          encryptedGroupKey: string | null;
        }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username,
            password,
            inviteToken,
            publicKey: serializeKey(publicKey),
          }),
        });

        // Store keys in safeStorage
        try {
          await window.api.secureStorage.set('private-key', serializeKey(secretKey));
          await window.api.secureStorage.set('public-key', serializeKey(publicKey));
          if (data.encryptedGroupKey) {
            await window.api.secureStorage.set('encrypted-group-key', data.encryptedGroupKey);
          }
        } catch {
          // safeStorage may not be available
        }

        // Decrypt group key
        let groupKey: Uint8Array | null = null;
        if (data.encryptedGroupKey) {
          groupKey = decryptGroupKey(data.encryptedGroupKey, publicKey, secretKey);
        }

        // Auto-login after registration: get tokens
        const loginData = await apiRequest<{
          accessToken: string;
          refreshToken: string;
          user: User;
          encryptedGroupKey: string | null;
        }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });

        set({
          user: loginData.user,
          accessToken: loginData.accessToken,
          refreshToken: loginData.refreshToken,
          groupKey,
          isLoading: false,
          error: null,
        });

        try {
          await window.api.secureStorage.set('accessToken', loginData.accessToken);
          await window.api.secureStorage.set('refreshToken', loginData.refreshToken);
        } catch {
          // safeStorage may not be available
        }
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        let message = 'Registration failed. Please try again.';
        if (error.code === 'INVALID_INVITE') {
          message = 'This invite is no longer valid.';
        } else if (error.code === 'USERNAME_TAKEN') {
          message = 'That username is taken. Try another.';
        } else if (error.code === 'INVALID_PUBLIC_KEY') {
          message = 'Encryption setup failed. Please try again.';
        }
        set({ isLoading: false, error: message });
      }
    },

    logout: async () => {
      const { refreshToken, accessToken } = get();
      set({ isLoading: true });

      try {
        if (refreshToken && accessToken) {
          await apiRequest('/api/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
          });
        }
      } catch {
        // Logout is best-effort — clear local state regardless
      }

      // Clear groupKey from memory but keep private key + encrypted group key in safeStorage
      set({ user: null, accessToken: null, refreshToken: null, groupKey: null, isLoading: false, error: null });

      try {
        await window.api.secureStorage.delete('accessToken');
        await window.api.secureStorage.delete('refreshToken');
      } catch {
        // safeStorage may not be available
      }
    },

    refreshTokens: async () => {
      const { refreshToken } = get();
      if (!refreshToken) throw new Error('No refresh token');

      const data = await apiRequest<{
        accessToken: string;
        refreshToken: string;
      }>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });

      set({ accessToken: data.accessToken, refreshToken: data.refreshToken });

      try {
        await window.api.secureStorage.set('accessToken', data.accessToken);
        await window.api.secureStorage.set('refreshToken', data.refreshToken);
      } catch {
        // safeStorage may not be available
      }
    },

    restoreSession: async () => {
      set({ isLoading: true });

      try {
        const accessToken = await window.api.secureStorage.get('accessToken');
        const refreshToken = await window.api.secureStorage.get('refreshToken');

        if (!accessToken || !refreshToken) {
          set({ isLoading: false });
          return;
        }

        set({ accessToken, refreshToken });

        // Try to use the access token to get user info by making a refresh call
        // This validates the tokens and gets a fresh pair
        try {
          const data = await apiRequest<{
            accessToken: string;
            refreshToken: string;
          }>('/api/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
          });

          // Decode user info from the new access token (JWT payload)
          const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
          set({
            user: { id: payload.userId, username: payload.username, role: payload.role },
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isLoading: false,
          });

          await window.api.secureStorage.set('accessToken', data.accessToken);
          await window.api.secureStorage.set('refreshToken', data.refreshToken);

          // Restore group key from safeStorage
          try {
            await initializeSodium();
            const privateKeyB64 = await window.api.secureStorage.get('private-key');
            const publicKeyB64 = await window.api.secureStorage.get('public-key');
            const encryptedGroupKeyB64 = await window.api.secureStorage.get('encrypted-group-key');
            if (privateKeyB64 && publicKeyB64 && encryptedGroupKeyB64) {
              const privateKey = deserializeKey(privateKeyB64);
              const publicKey = deserializeKey(publicKeyB64);
              const groupKey = decryptGroupKey(encryptedGroupKeyB64, publicKey, privateKey);
              set({ groupKey });
            }
          } catch {
            // Encryption keys not available — group key will be null
          }
        } catch {
          // Tokens are invalid, clear everything
          set({ user: null, accessToken: null, refreshToken: null, groupKey: null, isLoading: false });
          await window.api.secureStorage.delete('accessToken');
          await window.api.secureStorage.delete('refreshToken');
        }
      } catch {
        // safeStorage unavailable
        set({ isLoading: false });
      }
    },

    clearError: () => set({ error: null }),
  };
});

export default useAuthStore;
