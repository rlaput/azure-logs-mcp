import { startStdioServer } from "./stdio-server";

// Start the stdio server
startStdioServer().catch((error) => {
  console.error("Unhandled error during startup:", error);
  process.exit(1);
});
