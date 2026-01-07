import { useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";

interface FileDropTextareaProps {
    value: string;
    onChange: (value: string) => void;
    onError?: (error: string) => void;
    placeholder?: string;
    className?: string;
    /** File extensions to accept (e.g., ['.crt', '.pem']) */
    acceptedExtensions?: string[];
    /** Drop zone label shown when dragging */
    dropLabel?: string;
    disabled?: boolean;
}

export function FileDropTextarea({
    value,
    onChange,
    onError,
    placeholder,
    className = "",
    acceptedExtensions = [".crt", ".pem", ".cer", ".txt"],
    dropLabel = "Drop file here",
    disabled = false,
}: FileDropTextareaProps) {
    const [isDragging, setIsDragging] = useState(false);

    const handleFileDrop = useCallback(
        async (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            if (disabled) return;

            const file = e.dataTransfer.files?.[0];
            if (!file) return;

            // Validate file extension
            const hasValidExtension = acceptedExtensions.some((ext) =>
                file.name.toLowerCase().endsWith(ext)
            );

            if (!hasValidExtension && !file.type.startsWith("text/")) {
                onError?.(
                    `Please drop a valid file (${acceptedExtensions.join(", ")})`
                );
                return;
            }

            try {
                const content = await file.text();
                onChange(content);
            } catch {
                onError?.("Failed to read file");
            }
        },
        [acceptedExtensions, disabled, onChange, onError]
    );

    const handleDragOver = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
        },
        []
    );

    const handleDragEnter = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setIsDragging(true);
        },
        [disabled]
    );

    const handleDragLeave = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
        },
        []
    );

    return (
        <div
            onDrop={handleFileDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            className={`relative rounded-md transition-all ${
                isDragging ? "ring-2 ring-blue-500 ring-offset-2" : ""
            }`}
        >
            <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={className}
                disabled={disabled}
            />
            {isDragging && (
                <div className="absolute inset-0 bg-blue-500/10 rounded-md flex items-center justify-center pointer-events-none">
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {dropLabel}
                    </span>
                </div>
            )}
        </div>
    );
}
