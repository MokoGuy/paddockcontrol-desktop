import fs from "fs";
import path from "path";
import os from "os";

const testDataDir = path.join(os.tmpdir(), "paddockcontrol-e2e-test");

async function globalSetup() {
  // Clean up test data directory to ensure fresh state
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
    console.log(`Cleaned test data directory: ${testDataDir}`);
  }

  // Create fresh directory
  fs.mkdirSync(testDataDir, { recursive: true });
  console.log(`Created fresh test data directory: ${testDataDir}`);
}

export default globalSetup;
