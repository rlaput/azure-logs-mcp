/**
 * Utility functions for logging, rate limiting, and other common operations
 */

// Simple in-memory rate limiter
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Simple rate limiter implementation
 */
export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 10, windowMs = 60000) { // 10 requests per minute by default
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Extract client identifier from request context
   * @param req - Express request object or similar context
   * @returns Unique client identifier
   */
  static extractClientId(req?: { headers?: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }): string {
    if (!req) {return 'default';}
    
    // Try to get client ID from headers first
    const clientIdHeader = req.headers?.['x-client-id'] || req.headers?.['mcp-client-id'];
    if (clientIdHeader && typeof clientIdHeader === 'string') {
      return clientIdHeader;
    }
    
    // Fall back to IP address
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  /**
   * Check if a client has exceeded the rate limit
   * @param clientId - Unique identifier for the client
   * @returns true if request is allowed, false if rate limited
   */
  checkLimit(clientId: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(clientId);

    if (!entry || now > entry.resetTime) {
      // First request or window has reset
      this.limits.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false; // Rate limited
    }

    // Increment count
    entry.count++;
    return true;
  }

  /**
   * Get current usage for a client
   * @param clientId - Unique identifier for the client
   * @returns Current request count and reset time
   */
  getUsage(clientId: string): { count: number; resetTime: number; remaining: number } {
    const entry = this.limits.get(clientId);
    if (!entry || Date.now() > entry.resetTime) {
      return { count: 0, resetTime: Date.now() + this.windowMs, remaining: this.maxRequests };
    }
    return { 
      count: entry.count, 
      resetTime: entry.resetTime, 
      remaining: Math.max(0, this.maxRequests - entry.count) 
    };
  }

  /**
   * Clear rate limit data for a client
   * @param clientId - Unique identifier for the client
   */
  clearLimit(clientId: string): void {
    this.limits.delete(clientId);
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [clientId, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(clientId);
      }
    }
  }
}

// Create a global rate limiter instance
export const rateLimiter = new RateLimiter();

// Set up periodic cleanup
setInterval(() => {
  rateLimiter.cleanup();
}, 60000); // Clean up every minute

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

/**
 * Logger interface
 */
export interface Logger {
  error(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

/**
 * Simple structured logger implementation
 */
class SimpleLogger implements Logger {
  private readonly name: string;
  private readonly level: LogLevel;

  constructor(name: string, level: LogLevel = LogLevel.INFO) {
    this.name = name;
    this.level = level;
  }

  private log(level: LogLevel, levelName: string, message: string, meta?: unknown): void {
    if (level <= this.level) {
      const timestamp = new Date().toISOString();
      const logEntry: Record<string, unknown> = {
        timestamp,
        level: levelName,
        logger: this.name,
        message
      };
      
      if (meta !== undefined) {
        logEntry['meta'] = meta;
      }
      
      // Use stderr for error/warn, stdout for info/debug
      const output = level <= LogLevel.WARN ? console.error : console.log;
      output(JSON.stringify(logEntry));
    }
  }

  error(message: string, meta?: unknown): void {
    this.log(LogLevel.ERROR, 'ERROR', message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.log(LogLevel.WARN, 'WARN', message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.log(LogLevel.INFO, 'INFO', message, meta);
  }

  debug(message: string, meta?: unknown): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, meta);
  }
}

/**
 * Create a logger instance
 * @param name - Logger name
 * @param level - Log level (defaults to INFO, or DEBUG if NODE_ENV is development)
 * @returns Logger instance
 */
export function createLogger(name: string, level?: LogLevel): Logger {
  // Check for LOG_LEVEL environment variable first
  let defaultLevel = LogLevel.INFO;
  
  if (process.env['LOG_LEVEL']) {
    const envLevel = parseInt(process.env['LOG_LEVEL'], 10);
    if (!isNaN(envLevel) && envLevel >= LogLevel.ERROR && envLevel <= LogLevel.DEBUG) {
      defaultLevel = envLevel;
    }
  } else if (process.env['NODE_ENV'] === 'development') {
    defaultLevel = LogLevel.DEBUG;
  }
  
  return new SimpleLogger(name, level ?? defaultLevel);
}

/**
 * Utility function to safely stringify objects for logging
 * @param obj - Object to stringify
 * @returns Safely stringified object
 */
export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    return `[Unstringifiable object: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
}

/**
 * Utility function to redact sensitive information from objects
 * @param obj - Object to redact
 * @param sensitiveKeys - Array of keys to redact
 * @returns Object with sensitive values redacted
 */
export function redactSensitiveInfo(obj: Record<string, unknown>, sensitiveKeys: string[] = ['password', 'secret', 'token', 'key']): Record<string, unknown> {
  const redacted = { ...obj };
  
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    }
  }
  
  return redacted;
}

/**
 * Utility function to validate and parse environment variables
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @param required - Whether the variable is required
 * @returns Parsed value
 */
export function getEnvVar(key: string, defaultValue?: string, required = false): string {
  const value = process.env[key] || defaultValue;
  
  if (required && !value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  
  return value || '';
}

/**
 * Utility function to parse boolean environment variables
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Boolean value
 */
export function getEnvBool(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Utility function to parse numeric environment variables
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Numeric value
 */
export function getEnvNumber(key: string, defaultValue = 0): number {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}