import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface CertificateDescriptionEditorProps {
    note: string;
    placeholder?: string;
    onSave: (note: string) => Promise<void>;
    disabled?: boolean;
}

interface InlineEditFieldProps {
    value: string;
    placeholder: string;
    label?: string;
    onSave: (value: string) => Promise<void>;
    disabled?: boolean;
    className?: string;
}

function InlineEditField({
    value,
    placeholder,
    label,
    onSave,
    disabled = false,
    className,
}: InlineEditFieldProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync external value
    useEffect(() => {
        if (!isEditing) {
            setEditValue(value);
        }
    }, [value, isEditing]);

    // Focus textarea when editing starts
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(
                editValue.length,
                editValue.length
            );
        }
    }, [isEditing, editValue.length]);

    const handleSave = useCallback(async () => {
        const trimmedValue = editValue.trim();
        // Only save if value changed
        if (trimmedValue !== value) {
            setIsSaving(true);
            try {
                await onSave(trimmedValue);
            } catch (err) {
                console.error("Failed to save:", err);
            } finally {
                setIsSaving(false);
            }
        }
        setIsEditing(false);
    }, [editValue, value, onSave]);

    const handleCancel = useCallback(() => {
        setIsEditing(false);
        setEditValue(value);
    }, [value]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
                handleCancel();
            } else if (e.key === "Enter" && e.ctrlKey) {
                e.preventDefault();
                handleSave();
            }
        },
        [handleCancel, handleSave]
    );

    const handleClick = useCallback(() => {
        if (!disabled && !isEditing) {
            setIsEditing(true);
        }
    }, [disabled, isEditing]);

    if (isEditing) {
        return (
            <div className={cn("space-y-2", className)}>
                {label && (
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                        {label}
                    </p>
                )}
                <Textarea
                    ref={textareaRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                        // Small delay to allow button clicks to register
                        setTimeout(() => {
                            if (!isSaving) {
                                handleCancel();
                            }
                        }, 150);
                    }}
                    placeholder={placeholder}
                    className="min-h-[60px] resize-y text-sm"
                    disabled={isSaving}
                />
                <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs text-muted-foreground mr-auto">
                        Ctrl+Enter to save
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="h-7 px-2"
                    >
                        <HugeiconsIcon
                            icon={Cancel01Icon}
                            className="w-3.5 h-3.5 mr-1"
                            strokeWidth={2}
                        />
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-7 px-2"
                    >
                        <HugeiconsIcon
                            icon={Tick02Icon}
                            className="w-3.5 h-3.5 mr-1"
                            strokeWidth={2}
                        />
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            {label && (
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    {label}
                </p>
            )}
            <p
                onClick={handleClick}
                className={cn(
                    "text-sm whitespace-pre-wrap py-1 px-2 -mx-2 transition-colors",
                    value
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50 italic",
                    !disabled &&
                        "cursor-text hover:bg-muted/50 focus:bg-muted/50",
                    disabled && "cursor-default"
                )}
                role={disabled ? undefined : "button"}
                tabIndex={disabled ? undefined : 0}
                onKeyDown={(e) => {
                    if (!disabled && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setIsEditing(true);
                    }
                }}
            >
                {value || placeholder}
            </p>
        </div>
    );
}

export function CertificateDescriptionEditor({
    note,
    placeholder = "Click to add description...",
    onSave,
    disabled = false,
}: CertificateDescriptionEditorProps) {
    return (
        <div className="mb-6">
            <InlineEditField
                value={note}
                placeholder={placeholder}
                onSave={onSave}
                disabled={disabled}
            />
        </div>
    );
}
