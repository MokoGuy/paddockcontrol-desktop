import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { SecurityKeyInfo } from "@/types";

// useSecurityKeys manages the app's unlock methods (password / OS keyring /
// passkey) and platform availability.
export function useSecurityKeys() {
    const [methods, setMethods] = useState<SecurityKeyInfo[]>([]);
    const [osAvailable, setOsAvailable] = useState(false);
    const [webAuthnAvailable, setWebAuthnAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const [list, os, wa] = await Promise.all([
                api.listSecurityKeys(),
                api.isOSKeystoreAvailable(),
                api.isWebAuthnAvailable(),
            ]);
            setMethods(list || []);
            setOsAvailable(os);
            setWebAuthnAvailable(wa);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const enrollOSNative = useCallback(async () => {
        await api.enrollOSNative();
        await refresh();
    }, [refresh]);

    const enrollWebAuthn = useCallback(
        async (label: string) => {
            await api.enrollWebAuthn(label);
            await refresh();
        },
        [refresh],
    );

    const remove = useCallback(
        async (id: number) => {
            await api.removeSecurityKey(id);
            await refresh();
        },
        [refresh],
    );

    return {
        methods,
        osAvailable,
        webAuthnAvailable,
        isLoading,
        refresh,
        enrollOSNative,
        enrollWebAuthn,
        remove,
    };
}
