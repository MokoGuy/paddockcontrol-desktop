import { create } from "zustand";
import type { UpdateInfo } from "@/types";

type UpdateState = "idle" | "checking" | "downloading" | "complete" | "error";

interface UpdateStore {
    updateInfo: UpdateInfo | null;
    setUpdateInfo: (info: UpdateInfo | null) => void;

    updateState: UpdateState;
    setUpdateState: (state: UpdateState) => void;

    errorMessage: string | null;
    setErrorMessage: (msg: string | null) => void;
}

export const useUpdateStore = create<UpdateStore>((set) => ({
    updateInfo: null,
    setUpdateInfo: (info) => set({ updateInfo: info }),

    updateState: "idle",
    setUpdateState: (updateState) => set({ updateState }),

    errorMessage: null,
    setErrorMessage: (errorMessage) => set({ errorMessage }),
}));
