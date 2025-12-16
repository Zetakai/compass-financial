/**
 * API Configuration
 * 
 * To use this app, you need to:
 * 1. Sign up at https://eodhistoricaldata.com/
 * 2. Get your free API key
 * 3. Set it as an environment variable or replace the default below
 * 
 * For production, use environment variables:
 * - EXPO_PUBLIC_EODHD_API_KEY
 */

// Get API key from environment variable or use default key
// IMPORTANT: Replace with your actual API key from https://eodhistoricaldata.com/
export const EODHD_API_KEY = 
  process.env.EXPO_PUBLIC_EODHD_API_KEY || 
  '32623626'; // Your EODHD API key

// Default symbols to track
export const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];

