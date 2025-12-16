/**
 * API Configuration
 * 
 * We support two providers:
 * 1. Finnhub (Recommended - Free tier includes WebSocket!)
 *    - Sign up at https://finnhub.io/
 *    - Free tier: 60 calls/min, WebSocket access included
 * 
 * 2. EODHD (May require paid plan for WebSocket)
 *    - Sign up at https://eodhistoricaldata.com/
 * 
 * For production, use environment variables:
 * - EXPO_PUBLIC_FINNHUB_API_KEY
 * - EXPO_PUBLIC_EODHD_API_KEY
 */

// Provider selection: 'finnhub' or 'eodhd'
export const API_PROVIDER = (process.env.EXPO_PUBLIC_API_PROVIDER || 'finnhub') as 'finnhub' | 'eodhd';

// Finnhub API Key (Recommended - Free tier includes WebSocket!)
export const FINNHUB_API_KEY = 
  process.env.EXPO_PUBLIC_FINNHUB_API_KEY || 
  ''; // Get your free API key from https://finnhub.io/

// EODHD API Key (May require paid plan for WebSocket)
export const EODHD_API_KEY = 
  process.env.EXPO_PUBLIC_EODHD_API_KEY || 
  ''; // Your EODHD API key

// Default symbols to track
export const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];

