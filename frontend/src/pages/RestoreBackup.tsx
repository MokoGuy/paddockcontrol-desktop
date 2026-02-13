import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { stepAnimations } from "@/lib/animations";
import { useSetup } from "@/hooks/useSetup";
import { useAppStore } from "@/stores/useAppStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { BackupPeekInfo } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { StatusAlert } from "@/components/shared/StatusAlert";
import { ReviewSection, ReviewField } from "@/components/shared/ReviewField";

export function RestoreBackup() {
  const navigate = useNavigate();
  const {
    setIsSetupComplete,
    setIsWaitingForEncryptionKey,
    setIsUnlocked,
  } = useAppStore();
  const { isLoading, error, peekBackupInfo, restoreFromBackupFile, selectBackupFile, clearError } = useSetup();
  const [step, setStep] = useState<"file" | "confirm">("file");
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [peekInfo, setPeekInfo] = useState<BackupPeekInfo | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectFile = async () => {
    clearError();
    setIsSelecting(true);
    try {
      const path = await selectBackupFile();
      if (!path) {
        setIsSelecting(false);
        return;
      }

      setBackupPath(path);
      const info = await peekBackupInfo(path);
      setIsSelecting(false);

      if (!info) return; // error is set by the hook
      setPeekInfo(info);
      setStep("confirm");
    } catch {
      setIsSelecting(false);
    }
  };

  const handleRestore = async () => {
    if (!backupPath) return;

    await restoreFromBackupFile(backupPath);

    // After restore, app needs to be unlocked with the backup's password
    setIsSetupComplete(true);
    setIsWaitingForEncryptionKey(false);
    setIsUnlocked(false);

    // Navigate to dashboard — the app will detect locked state
    // and prompt for the password
    navigate("/", { replace: true });
  };

  const handleBack = () => {
    if (step === "file") {
      navigate("/setup", { replace: true });
    } else {
      setBackupPath(null);
      setPeekInfo(null);
      clearError();
      setStep("file");
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="text-center mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Restore from Backup
        </h1>
        <p className="text-muted-foreground">
          Restore your database from a backup file
        </p>
      </div>

      <Card className="shadow-sm border-border">
        {/* Step Indicator */}
        <div className="border-b border-border px-6 pb-4">
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full font-semibold transition-all duration-200 ${
                step === "file" || step === "confirm"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step === "confirm" ? "\u2713" : "1"}
            </div>
            <span
              className={`transition-colors duration-200 ${
                step === "file"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Select File
            </span>
            <div className="flex-1 h-0.5 mx-2 bg-muted transition-colors duration-200" />

            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full font-semibold transition-all duration-200 ${
                step === "confirm"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              2
            </div>
            <span
              className={`transition-colors duration-200 ${
                step === "confirm"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Confirm
            </span>
          </div>
        </div>

        <CardContent>
          <AnimatePresence mode="wait">
            {/* Step 1: File Selection */}
            {step === "file" && (
              <motion.div
                key="file"
                {...stepAnimations}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label>Select Backup File</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose a .db database backup file to restore from.
                    This will replace your current database entirely.
                  </p>
                </div>

                <Button
                  onClick={handleSelectFile}
                  disabled={isSelecting || isLoading}
                  className="w-full"
                >
                  {isSelecting ? "Reading backup..." : "Select Backup File (.db)"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="w-full"
                >
                  Back
                </Button>
              </motion.div>
            )}

            {/* Step 2: Confirm */}
            {step === "confirm" && peekInfo && (
              <motion.div
                key="confirm"
                {...stepAnimations}
                className="space-y-4"
              >
                <ReviewSection title="Backup Contents">
                  <ReviewField label="Certificates" value={String(peekInfo.certificate_count)} />
                  {peekInfo.ca_name && (
                    <ReviewField label="CA Name" value={peekInfo.ca_name} />
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Security Keys</span>
                    <Badge variant={peekInfo.has_security_keys ? "default" : "secondary"}>
                      {peekInfo.has_security_keys ? "Present" : "None"}
                    </Badge>
                  </div>
                </ReviewSection>

                {peekInfo.hostnames.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Hostnames</Label>
                    <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto border border-border p-2">
                      {peekInfo.hostnames.map((hostname) => (
                        <Badge
                          key={hostname}
                          variant="secondary"
                          className="font-mono text-xs"
                        >
                          {hostname}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <StatusAlert variant="warning">
                  This will replace your current database. After restore, you will
                  need to enter the backup's password to unlock.
                </StatusAlert>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleRestore}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? "Restoring..." : "Restore Now"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          {error && (
            <StatusAlert
              variant="destructive"
              className="mt-4"
              icon={
                <HugeiconsIcon
                  icon={AlertCircleIcon}
                  className="size-4"
                  strokeWidth={2}
                />
              }
            >
              {error}
            </StatusAlert>
          )}

          {/* Loading State */}
          {isLoading && step !== "file" && (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner text="Processing..." />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
