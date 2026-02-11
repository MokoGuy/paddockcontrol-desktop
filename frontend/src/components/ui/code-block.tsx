import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Copy01Icon,
    Tick02Icon,
} from "@hugeicons/core-free-icons";

interface CodeBlockProps {
    content: string;
    maxHeight?: string;
    showCopy?: boolean;
    className?: string;
}

export function CodeBlock({
    content,
    maxHeight = "max-h-48",
    showCopy = true,
    className,
}: CodeBlockProps) {
    const { copy, isCopied } = useCopyToClipboard();

    return (
        <div className="relative">
            <pre
                className={cn(
                    "bg-accent text-accent-foreground",
                    "ring-1 ring-border",
                    "rounded-none",
                    "p-4 text-xs overflow-auto font-mono scrollbar-float",
                    maxHeight,
                    className,
                )}
            >
                {content}
            </pre>
            {showCopy && (
                <div className="absolute top-2 right-4 flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => copy(content)}
                    >
                        <HugeiconsIcon
                            icon={
                                isCopied(content)
                                    ? Tick02Icon
                                    : Copy01Icon
                            }
                            className={cn(
                                "w-4 h-4",
                                isCopied(content) && "text-primary",
                            )}
                            strokeWidth={2}
                        />
                    </Button>
                </div>
            )}
        </div>
    );
}
