import { create } from 'zustand';

type NotificationType = 'kicked' | 'banned' | null;

interface AdminNotificationState {
  notification: NotificationType;
  showKicked: () => void;
  showBanned: () => void;
  dismiss: () => void;
}

export const useAdminNotificationStore = create<AdminNotificationState>((set) => ({
  notification: null,
  showKicked: () => set({ notification: 'kicked' }),
  showBanned: () => set({ notification: 'banned' }),
  dismiss: () => set({ notification: null }),
}));
