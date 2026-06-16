import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { SecurityKeyInfo } from "@/types";

// useSecurityKeys manages the app's unlock methods (password / passkey) and
// platform availability.
export function useSecurityKeys() {
    const [methods, setMethods] = useState<SecurityKeyInfo[]>([]);
    const [webAuthnAvailable, setWebAuthnAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const [list, wa] = await Promise.all([
                api.listSecurityKeys(),
                api.isWebAuthnAvailable(),
            ]);
            setMethods(list || []);
            setWebAuthnAvailable(wa);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const enrollPasskey = useCallback(async () => {
        await api.enrollPasskey();
        await refresh();
    }, [refresh]);

    const remove = useCallback(
        async (id: number) => {
            await api.removeSecurityKey(id);
            await refresh();
        },
        [refresh],
    );

    return {
        methods,
        webAuthnAvailable,
        isLoading,
        refresh,
        enrollPasskey,
        remove,
    };
}
