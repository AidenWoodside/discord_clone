import { create } from 'zustand';

interface UIState {
  isMemberListVisible: boolean;
  isSettingsOpen: boolean;
  toggleMemberList: () => void;
  setMemberListVisible: (visible: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isMemberListVisible: true,
  isSettingsOpen: false,
  toggleMemberList: () => set((state) => ({ isMemberListVisible: !state.isMemberListVisible })),
  setMemberListVisible: (visible) => set({ isMemberListVisible: visible }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
}));
