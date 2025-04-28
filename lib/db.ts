import { Pool, PoolClient } from 'pg';

// Connection retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Configure connection pool with optimized settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 5000, // 5 seconds
  idleTimeoutMillis: 30000,
  max: 10,
  maxUses: 7500, // Reset connection after 7500 queries
  statement_timeout: 10000, // 10 second statement timeout
  query_timeout: 10000 // 10 second query timeout
});

// Add error handler to the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function executeWithRetry(operation: (client: PoolClient) => Promise<any>): Promise<any> {
  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    let client: PoolClient | null = null;
    
    try {
      client = await pool.connect();
      return await operation(client);
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${retryCount + 1} failed:`, error.message);
      
      // Don't retry on validation errors
      if (error.code === '23505' || error.code === '23502') {
        throw error;
      }
      
      // Wait before retrying, with exponential backoff
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      retryCount++;
    } finally {
      if (client) {
        client.release(true); // Release with error = true to destroy the connection if there was an error
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
} 