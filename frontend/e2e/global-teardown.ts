export default async function globalTeardown() {
  console.log("Cleaning up test processes...");

  // Give Playwright time to handle webServer termination gracefully
  // The EPIPE errors happen when we kill processes too quickly
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log("Test cleanup complete");
}
