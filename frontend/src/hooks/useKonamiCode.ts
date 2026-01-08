import { useEffect, useRef, useCallback } from "react";

const KONAMI_CODE = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
];

const TIMEOUT_MS = 2000;

export function useKonamiCode(onSuccess: () => void): void {
    const sequenceRef = useRef<string[]>([]);
    const timeoutRef = useRef<number | null>(null);

    const resetSequence = useCallback((reason?: string) => {
        if (sequenceRef.current.length > 0 && reason) {
            console.debug(`[Konami] Sequence reset: ${reason}`);
        }
        sequenceRef.current = [];
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Reset timeout on each keypress
            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = window.setTimeout(() => resetSequence("timeout"), TIMEOUT_MS);

            // Use event.key for letters (layout-independent), event.code for arrows
            const key = event.code.startsWith("Arrow") ? event.code : event.key.toLowerCase();
            const nextIndex = sequenceRef.current.length;
            const expectedKey = KONAMI_CODE[nextIndex];

            if (key === expectedKey) {
                sequenceRef.current.push(key);
                const progress = sequenceRef.current.length;
                const total = KONAMI_CODE.length;
                console.debug(`[Konami] Progress: ${progress}/${total} (${key})`);

                if (progress === total) {
                    console.debug("[Konami] Sequence complete!");
                    resetSequence();
                    onSuccess();
                }
            } else {
                // Wrong key - reset sequence
                if (sequenceRef.current.length > 0) {
                    console.debug(`[Konami] Wrong key: expected ${expectedKey}, got ${key}`);
                }
                resetSequence();
                // Check if this key could be the start of a new sequence
                if (key === KONAMI_CODE[0]) {
                    sequenceRef.current.push(key);
                    console.debug(`[Konami] Progress: 1/${KONAMI_CODE.length} (${key})`);
                    timeoutRef.current = window.setTimeout(() => resetSequence("timeout"), TIMEOUT_MS);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, [onSuccess, resetSequence]);
}
