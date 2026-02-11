import { useState, useCallback, useRef } from "react";

interface FileDropZoneProps {
    /** Called when a file is selected (via click or drop) */
    onFileSelect: (file: File) => void;
    /** Called when an invalid file is dropped */
    onError?: (error: string) => void;
    /** File input accept attribute (e.g., ".json") */
    accept?: string;
    /** File extensions to validate (e.g., [".json"]) */
    acceptedExtensions?: string[];
    /** Main label text */
    label?: string;
    /** Secondary label text */
    sublabel?: string;
    /** Label shown when dragging over */
    dropLabel?: string;
    /** Icon to display */
    icon?: React.ReactNode;
    /** Disabled state */
    disabled?: boolean;
    /** Currently selected file (to show filename) */
    selectedFile?: File | null;
}

export function FileDropZone({
    onFileSelect,
    onError,
    accept,
    acceptedExtensions = [],
    label = "Click to select or drag and drop",
    sublabel,
    dropLabel = "Drop file here",
    icon,
    disabled = false,
    selectedFile,
}: FileDropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const validateFile = useCallback(
        (file: File): boolean => {
            if (acceptedExtensions.length === 0) return true;

            const hasValidExtension = acceptedExtensions.some((ext) =>
                file.name.toLowerCase().endsWith(ext.toLowerCase())
            );

            if (!hasValidExtension) {
                onError?.(
                    `Please select a valid file (${acceptedExtensions.join(", ")})`
                );
                return false;
            }
            return true;
        },
        [acceptedExtensions, onError]
    );

    const handleFileDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            if (disabled) return;

            const file = e.dataTransfer.files?.[0];
            if (!file) return;

            if (validateFile(file)) {
                onFileSelect(file);
            }
        },
        [disabled, onFileSelect, validateFile]
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

    const handleClick = useCallback(() => {
        if (!disabled && inputRef.current) {
            inputRef.current.click();
        }
    }, [disabled]);

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (validateFile(file)) {
                onFileSelect(file);
            }

            // Reset input so the same file can be selected again
            e.target.value = "";
        },
        [onFileSelect, validateFile]
    );

    return (
        <div
            onClick={handleClick}
            onDrop={handleFileDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
            } ${
                isDragging
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/60 hover:bg-primary/10"
            }`}
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleInputChange}
                className="hidden"
                disabled={disabled}
            />

            {isDragging ? (
                <div className="py-4">
                    <span className="text-primary font-medium">
                        {dropLabel}
                    </span>
                </div>
            ) : (
                <>
                    {icon && <div className="mb-2 flex justify-center">{icon}</div>}
                    <p className="font-semibold text-foreground mb-1">
                        {label}
                    </p>
                    {sublabel && (
                        <p className="text-sm text-muted-foreground">
                            {sublabel}
                        </p>
                    )}
                    {selectedFile && (
                        <p className="text-sm text-success mt-2">
                            Selected: {selectedFile.name}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
