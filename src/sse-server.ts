import { startHttpServer } from './http-server';

// Start the HTTP server
startHttpServer().catch((error) => {
  console.error('Unhandled error during startup:', error);
  process.exit(1);
});
