import { z } from 'zod';

// Environment variables interface
export interface EnvironmentConfig {
  AZURE_CLIENT_ID: string;
  AZURE_TENANT_ID: string;
  AZURE_CLIENT_SECRET: string;
  AZURE_MONITOR_WORKSPACE_ID: string;
}

// Azure Application Insights query result types
export interface QueryResult {
  tables: QueryTable[];
  statistics?: QueryStatistics;
  render?: QueryRender;
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

export interface QueryStatistics {
  query: QueryExecutionStatistics;
}

export interface QueryExecutionStatistics {
  executionTime: number;
  resourceUsage: ResourceUsage;
  inputDatasetStatistics: DatasetStatistics;
  outputDatasetStatistics: DatasetStatistics;
}

export interface ResourceUsage {
  cache: CacheStatistics;
  cpu: CpuStatistics;
  memory: MemoryStatistics;
}

export interface CacheStatistics {
  memory: {
    hits: number;
    misses: number;
    total: number;
  };
  disk: {
    hits: number;
    misses: number;
    total: number;
  };
}

export interface CpuStatistics {
  user: string;
  kernel: string;
  total: string;
}

export interface MemoryStatistics {
  peak: number;
}

export interface DatasetStatistics {
  tableCount: number;
  columnCount: number;
  rowCount: number;
  size: number;
}

export interface QueryRender {
  visualization: string;
  title?: string;
  accumulate?: boolean;
  isQuerySorted?: boolean;
  kind?: string;
  legend?: string;
  series?: string;
  yMin?: string;
  yMax?: string;
  xAxis?: string;
  yAxis?: string;
  xColumn?: string;
  yColumns?: string[];
}

// MCP Tool definition type
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

// Validation schemas
export const GetLogsByOrderNumberSchema = z.object({
  orderNumber: z.string()
    .min(1, "Order number cannot be empty")
    .max(50, "Order number too long")
    .regex(/^[A-Za-z0-9\-_]+$/, "Invalid order number format. Only alphanumeric characters, hyphens, and underscores are allowed.")
    .describe("The order number to search for in the Azure Application Insights logs")
});

export type GetLogsByOrderNumberInput = z.infer<typeof GetLogsByOrderNumberSchema>;

// Error types
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
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'QueryError';
  }
}