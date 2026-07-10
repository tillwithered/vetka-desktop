export function startBackgroundServices(dependencies: {
  updates?: { start(): void };
  scan?: { start(): void };
}): void {
  dependencies.scan?.start();
  try {
    dependencies.updates?.start();
  } catch {
    // Updating must never prevent the local price monitor from operating.
  }
}
