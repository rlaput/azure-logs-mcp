import { ClientSecretCredential } from '@azure/identity';
import { LogsQueryClient } from '@azure/monitor-query-logs';

// --- Types & Interfaces ---

export interface EnvironmentConfig {
  AZURE_CLIENT_ID: string;
  AZURE_TENANT_ID: string;
  AZURE_CLIENT_SECRET: string;
  AZURE_MONITOR_WORKSPACE_ID: string;
}

export interface QueryResult {
  tables: QueryTable[];
  statistics?: any;
  render?: any;
}

export interface QueryTable {
  name: string;
  columns: QueryColumn[];
  rows: unknown[][];
}

export interface QueryColumn {
  name: string;
  type: string;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class QueryError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'QueryError';
  }
}

interface LambdaEvent {
  searchTerm?: string;
  limit?: number;
  duration?: string;
}

// --- Helper Functions ---

function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    throw new ValidationError('Input must be a string');
  }

  // Remove or escape potentially dangerous characters
  const sanitized = input.replace(/[^\w\-.]/g, '');

  if (sanitized.length === 0) {
    throw new ValidationError('Invalid search term format');
  }

  if (sanitized.length > 100) {
    throw new ValidationError('Search term too long');
  }

  return sanitized;
}

function validateSearchTerm(searchTerm: string): string {
  if (!searchTerm || typeof searchTerm !== 'string') {
    throw new ValidationError(
      'Search term is required and must be a string',
    );
  }

  const trimmed = searchTerm.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Search term cannot be empty');
  }

  const searchTermRegex = /^[A-Za-z0-9\-_.]+$/;
  if (!searchTermRegex.test(trimmed)) {
    throw new ValidationError(
      'Invalid search term format. Only alphanumeric characters, hyphens, underscores, and dots are allowed.',
    );
  }

  return trimmed;
}

function validateEnvironment(
  env: Record<string, string | undefined>,
): EnvironmentConfig {
  const required = [
    'AZURE_CLIENT_ID',
    'AZURE_TENANT_ID',
    'AZURE_CLIENT_SECRET',
    'AZURE_MONITOR_WORKSPACE_ID',
  ] as const;
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new ConfigurationError(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  return {
    AZURE_CLIENT_ID: env['AZURE_CLIENT_ID']!,
    AZURE_TENANT_ID: env['AZURE_TENANT_ID']!,
    AZURE_CLIENT_SECRET: env['AZURE_CLIENT_SECRET']!,
    AZURE_MONITOR_WORKSPACE_ID: env['AZURE_MONITOR_WORKSPACE_ID']!,
  };
}

function createKustoQuery(sanitizedSearchTerm: string, limit: number): string {
  return `
    let searchTerm = "${sanitizedSearchTerm}";
    union isfuzzy=true AppRequests, AppDependencies
    | where Url has searchTerm or tostring(Properties) has searchTerm or Name has searchTerm
    | project TimeGeneratedUtc=TimeGenerated, Name, Url, ResultCode, DurationMs, RequestBody=Properties["Request-Body"], ResponseBody=Properties["Response-Body"]
    | order by TimeGeneratedUtc desc
    | limit ${limit}
  `;
}

async function searchLogs(
  searchTerm: string,
  limit: number = 50,
  duration: string = 'P7D',
): Promise<QueryResult> {
  try {
    const validatedSearchTerm = validateSearchTerm(searchTerm);
    const sanitizedSearchTerm = sanitizeInput(validatedSearchTerm);
    const config = validateEnvironment(process.env);

    const credential = new ClientSecretCredential(
      config.AZURE_TENANT_ID,
      config.AZURE_CLIENT_ID,
      config.AZURE_CLIENT_SECRET,
    );

    const logsQueryClient = new LogsQueryClient(credential);
    const kustoQuery = createKustoQuery(sanitizedSearchTerm, limit);

    const queryResult = await logsQueryClient.queryWorkspace(
      config.AZURE_MONITOR_WORKSPACE_ID,
      kustoQuery,
      { duration: duration },
    );

    return queryResult as unknown as QueryResult;
  } catch (error) {
    console.error('Error querying Application Insights:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      searchTerm: '[REDACTED]',
      timestamp: new Date().toISOString(),
      type: error instanceof Error ? error.constructor.name : 'Unknown',
    });

    if (
      error instanceof ValidationError ||
      error instanceof ConfigurationError
    ) {
      throw error;
    }

    throw new QueryError(
      'Failed to query logs. Please check your configuration and try again.',
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

// --- Lambda Handler ---

export const handler = async (event: any) => {
  let body = event;

  // Handle HTTP Function URL / API Gateway event structure
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      throw new ValidationError('Invalid JSON in request body');
    }
  }

  const searchTerm = body.searchTerm;
  const limit = body.limit ?? 50;
  const duration = body.duration ?? 'P7D';

  if (!searchTerm) {
    throw new Error('searchTerm is required');
  }

  try {
    const result = await searchLogs(searchTerm, limit, duration);
    return result.tables?.[0]?.rows || [];
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
};
