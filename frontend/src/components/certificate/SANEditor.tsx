import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    InputGroup,
    InputGroupInput,
    InputGroupAddon,
    InputGroupButton,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type SANType, hasSuffix } from "@/lib/validation";

// SAN entry with UI state
export interface SANInputEntry {
    value: string;
    type: SANType;
}

interface SANEditorProps {
    sanInputs: SANInputEntry[];
    setSanInputs: (inputs: SANInputEntry[]) => void;
    hostname: string;
    hostnameSuffix?: string;
    disabled?: boolean;
    error?: string | null;
}

export function SANEditor({
    sanInputs,
    setSanInputs,
    hostname,
    hostnameSuffix,
    disabled = false,
    error,
}: SANEditorProps) {
    const addSAN = () => {
        setSanInputs([...sanInputs, { value: "", type: "dns" }]);
    };

    const removeSAN = (index: number) => {
        setSanInputs(sanInputs.filter((_, i) => i !== index));
    };

    const updateSANType = (index: number, type: SANType) => {
        const newSans = [...sanInputs];
        newSans[index] = { ...newSans[index], type };
        setSanInputs(newSans);
    };

    const updateSANValue = (index: number, value: string) => {
        const newSans = [...sanInputs];
        newSans[index] = { ...newSans[index], value };
        setSanInputs(newSans);
    };

    const appendSuffix = (index: number) => {
        const san = sanInputs[index];
        if (san.value && hostnameSuffix && !hasSuffix(san.value, hostnameSuffix)) {
            updateSANValue(index, san.value + hostnameSuffix);
        }
    };

    return (
        <div className="space-y-2">
            <Label>Subject Alternative Names (SANs)</Label>
            <p className="text-xs text-muted-foreground">
                The hostname will be automatically included as the first SAN entry.
            </p>
            <p className="text-xs text-muted-foreground">
                This is required for browser validation of server certificates.
            </p>
            <div className="space-y-2">
                {/* Show hostname as first SAN */}
                <div className="flex gap-2">
                    <Select value="dns" disabled>
                        <SelectTrigger className="w-24 bg-muted">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="dns">DNS</SelectItem>
                        </SelectContent>
                    </Select>
                    <InputGroup className="flex-1 bg-muted">
                        <InputGroupInput
                            value={hostname || ""}
                            placeholder="Enter hostname first"
                            disabled
                        />
                    </InputGroup>
                    <Button
                        type="button"
                        variant="outline"
                        disabled
                        className="opacity-50 w-24"
                    >
                        Primary
                    </Button>
                </div>

                {/* Additional SANs */}
                {sanInputs.map((san, index) => (
                    <div key={index} className="flex gap-2">
                        <Select
                            value={san.type}
                            onValueChange={(value: SANType) => updateSANType(index, value)}
                            disabled={disabled}
                        >
                            <SelectTrigger className="w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="dns">DNS</SelectItem>
                                <SelectItem value="ip">IP</SelectItem>
                            </SelectContent>
                        </Select>
                        <InputGroup className="flex-1 bg-background">
                            <InputGroupInput
                                placeholder={
                                    san.type === "dns"
                                        ? "server.example.com"
                                        : "192.168.1.100 or 2001:db8::1"
                                }
                                className="cursor-text"
                                disabled={disabled}
                                value={san.value}
                                onChange={(e) => updateSANValue(index, e.target.value)}
                            />
                            {san.type !== "ip" && hostnameSuffix && (
                                <InputGroupAddon align="inline-end">
                                    <InputGroupButton
                                        onClick={() => appendSuffix(index)}
                                        disabled={
                                            disabled ||
                                            !san.value ||
                                            hasSuffix(san.value, hostnameSuffix)
                                        }
                                    >
                                        +{hostnameSuffix}
                                    </InputGroupButton>
                                </InputGroupAddon>
                            )}
                        </InputGroup>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => removeSAN(index)}
                            disabled={disabled}
                            className="w-24"
                        >
                            Remove
                        </Button>
                    </div>
                ))}

                <Button
                    type="button"
                    variant="outline"
                    onClick={addSAN}
                    disabled={disabled}
                >
                    Add SAN
                </Button>

                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
        </div>
    );
}
