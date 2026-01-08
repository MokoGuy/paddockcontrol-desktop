import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export function useCopyToClipboard(resetDelay = 2000) {
    const [copiedText, setCopiedText] = useState<string | null>(null);

    const copy = useCallback(
        async (text: string) => {
            try {
                await api.copyToClipboard(text);
                setCopiedText(text);
                setTimeout(() => setCopiedText(null), resetDelay);
                return true;
            } catch (err) {
                console.error("Failed to copy to clipboard:", err);
                return false;
            }
        },
        [resetDelay],
    );

    const isCopied = useCallback(
        (text: string) => copiedText === text,
        [copiedText],
    );

    return { copy, isCopied, copiedText };
}
