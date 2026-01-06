import { create } from 'zustand';
import { Config } from '../types';

interface ConfigState {
  config: Config | null;
  setConfig: (config: Config) => void;
  clearConfig: () => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  setConfig: (config) => set({ config }),
  clearConfig: () => set({ config: null }),
}));
