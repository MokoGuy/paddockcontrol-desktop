import { execSync } from "child_process";

export default async function globalTeardown() {
  console.log("Cleaning up test processes...");

  try {
    // Kill vite first (spawned by wails)
    execSync('pkill -9 -f "node.*vite" 2>/dev/null || true', { stdio: "ignore" });
    // Kill wails dev
    execSync('pkill -9 -f "wails dev" 2>/dev/null || true', { stdio: "ignore" });
    // Kill any remaining vite processes
    execSync('pkill -9 -f "/bin/vite" 2>/dev/null || true', { stdio: "ignore" });
    // Kill sh -c vite wrapper
    execSync('pkill -9 -f "sh -c vite" 2>/dev/null || true', { stdio: "ignore" });
  } catch {
    // Ignore errors
  }

  console.log("Test cleanup complete");
}
