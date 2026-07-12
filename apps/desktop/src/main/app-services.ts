export function startBackgroundServices(dependencies: {
  updates?: { start(): void };
  scan?: { start(): void };
  collectibles?: { start(): void };
}): void {
  try {
    dependencies.updates?.start();
  } catch {
    // Updating must never prevent the local workspace from opening.
  }
  try {
    dependencies.scan?.start();
  } catch {
    // A deferred local price check must never prevent the workspace from opening.
  }
  try {
    dependencies.collectibles?.start();
  } catch {
    // Mattel Creations availability must never prevent the workspace from opening.
  }
}
