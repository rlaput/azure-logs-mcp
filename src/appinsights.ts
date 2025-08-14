import { ClientSecretCredential } from '@azure/identity';
import { LogsQueryClient } from '@azure/monitor-query';
import type {
  EnvironmentConfig,
  QueryResult
} from './types';
import {
  ValidationError as ValidationErrorClass,
  ConfigurationError as ConfigurationErrorClass,
  QueryError as QueryErrorClass
} from './types';

/**
 * Sanitizes input to prevent injection attacks
 * @param input - The input string to sanitize
 * @returns The sanitized input
 * @throws ValidationError if input is invalid
 */
function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    throw new ValidationErrorClass('Input must be a string');
  }
  
  // Remove or escape potentially dangerous characters
  // Allow alphanumeric, hyphens, underscores, and basic punctuation
  const sanitized = input.replace(/[^\w\-_.]/g, '');
  
  if (sanitized.length === 0) {
    throw new ValidationErrorClass('Invalid order number format');
  }
  
  if (sanitized.length > 50) {
    throw new ValidationErrorClass('Order number too long');
  }
  
  return sanitized;
}

/**
 * Validates order number format
 * @param orderNumber - The order number to validate
 * @returns The validated order number
 * @throws ValidationError if order number is invalid
 */
function validateOrderNumber(orderNumber: string): string {
  if (!orderNumber || typeof orderNumber !== 'string') {
    throw new ValidationErrorClass('Order number is required and must be a string');
  }
  
  const trimmed = orderNumber.trim();
  if (trimmed.length === 0) {
    throw new ValidationErrorClass('Order number cannot be empty');
  }
  
  // Basic format validation - adjust regex based on your order number format
  const orderNumberRegex = /^[A-Za-z0-9\-_]{1,50}$/;
  if (!orderNumberRegex.test(trimmed)) {
    throw new ValidationErrorClass('Invalid order number format. Only alphanumeric characters, hyphens, and underscores are allowed.');
  }
  
  return trimmed;
}

/**
 * Validates environment configuration
 * @param env - Process environment variables
 * @returns Validated environment configuration
 * @throws ConfigurationError if required variables are missing
 */
function validateEnvironment(env: Record<string, string | undefined>): EnvironmentConfig {
  const required = ['AZURE_CLIENT_ID', 'AZURE_TENANT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_MONITOR_WORKSPACE_ID'] as const;
  const missing = required.filter(key => !env[key]);
  
  if (missing.length > 0) {
    throw new ConfigurationErrorClass(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return {
    AZURE_CLIENT_ID: env['AZURE_CLIENT_ID']!,
    AZURE_TENANT_ID: env['AZURE_TENANT_ID']!,
    AZURE_CLIENT_SECRET: env['AZURE_CLIENT_SECRET']!,
    AZURE_MONITOR_WORKSPACE_ID: env['AZURE_MONITOR_WORKSPACE_ID']!
  };
}

/**
 * Creates a Kusto query for searching logs by order number
 * @param sanitizedOrderNumber - The sanitized order number to search for
 * @returns The Kusto query string
 */
function createKustoQuery(sanitizedOrderNumber: string): string {
  return `
    let searchTerm = "${sanitizedOrderNumber}";
    union isfuzzy=true requests
    | where timestamp >= ago(30d)
    | where url contains searchTerm or tostring(customDimensions) contains searchTerm or name contains searchTerm
    | project timestamp, name, url, resultCode, duration, customDimensions
    | order by timestamp desc
    | limit 100
  `;
}

/**
 * Retrieves logs from Azure Application Insights by order number
 * @param orderNumber - The order number to search for in the logs
 * @returns Promise resolving to the query results from Application Insights
 * @throws ValidationError for invalid input
 * @throws ConfigurationError for missing environment variables
 * @throws QueryError for Azure query failures
 */
export async function getLogsByOrderNumber(orderNumber: string): Promise<QueryResult> {
  try {
    // Validate and sanitize input
    const validatedOrderNumber = validateOrderNumber(orderNumber);
    const sanitizedOrderNumber = sanitizeInput(validatedOrderNumber);
    
    // Validate environment configuration
    const config = validateEnvironment(process.env);
    
    // Create authentication credential
    const credential = new ClientSecretCredential(
      config.AZURE_TENANT_ID,
      config.AZURE_CLIENT_ID,
      config.AZURE_CLIENT_SECRET
    );

    // Create the logs query client
    const logsQueryClient = new LogsQueryClient(credential);

    // Create the Kusto query
    const kustoQuery = createKustoQuery(sanitizedOrderNumber);

    // Execute the query against the Application Insights workspace
    const queryResult = await logsQueryClient.queryWorkspace(
      config.AZURE_MONITOR_WORKSPACE_ID,
      kustoQuery,
      { duration: 'PT30M' } // 30 minute timeout
    );

    return queryResult as unknown as QueryResult;

  } catch (error) {
    // Log error details for debugging but don't expose sensitive information
    console.error('Error querying Application Insights:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      orderNumber: '[REDACTED]',
      timestamp: new Date().toISOString(),
      type: error instanceof Error ? error.constructor.name : 'Unknown'
    });
    
    // Re-throw known error types
    if (error instanceof ValidationErrorClass || error instanceof ConfigurationErrorClass) {
      throw error;
    }
    
    // Wrap unknown errors
    throw new QueryErrorClass(
      'Failed to query logs. Please check your configuration and try again.',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Health check function to verify Azure connectivity
 * @returns Promise resolving to true if connection is successful
 * @throws ConfigurationError for missing environment variables
 * @throws QueryError for connection failures
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const config = validateEnvironment(process.env);
    
    const credential = new ClientSecretCredential(
      config.AZURE_TENANT_ID,
      config.AZURE_CLIENT_ID,
      config.AZURE_CLIENT_SECRET
    );

    const logsQueryClient = new LogsQueryClient(credential);
    
    // Simple query to test connectivity
    const testQuery = 'print "health_check"';
    
    await logsQueryClient.queryWorkspace(
      config.AZURE_MONITOR_WORKSPACE_ID,
      testQuery,
      { duration: 'PT5M' }
    );
    
    return true;
  } catch (error) {
    console.error('Health check failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    
    if (error instanceof ConfigurationErrorClass) {
      throw error;
    }
    
    throw new QueryErrorClass(
      'Health check failed. Unable to connect to Azure Application Insights.',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}