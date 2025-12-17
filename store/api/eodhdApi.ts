/**
 * RTK Query API Slice for EODHD
 * 
 * EODHD Historical Data API Documentation:
 * https://eodhd.com/financial-apis/api-for-historical-data-and-volumes
 * 
 * Endpoint: https://eodhd.com/api/eod/{SYMBOL}?api_token={TOKEN}&fmt=json
 * Parameters: from, to, period (d=daily, w=weekly, m=monthly)
 */

import { EODHD_API_KEY } from '@/config/api';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { ChartData } from '../slices/stockDataSlice';
import { Timeframe } from '../slices/uiSlice';

/**
 * Format symbol for EODHD API (add .US suffix for US stocks if not present)
 */
function formatSymbol(symbol: string): string {
  // If symbol already has exchange suffix (e.g., .US, .LSE), use as is
  if (symbol.includes('.')) {
    return symbol;
  }
  // Otherwise, assume US stock and add .US suffix
  return `${symbol}.US`;
}

/**
 * Convert timeframe to EODHD period
 */
function getPeriod(timeframe: Timeframe): string {
  switch (timeframe) {
    case '1H':
    case '1D':
      return 'd'; // Daily
    case '1W':
      return 'w'; // Weekly
    case '1M':
    case '1Y':
      return 'm'; // Monthly
    default:
      return 'd';
  }
}

/**
 * Calculate date range based on timeframe
 * EODHD uses YYYY-MM-DD format
 */
function getDateRange(timeframe: Timeframe): { from: string; to: string } {
  const to = new Date();
  const toStr = to.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const from = new Date();
  
  switch (timeframe) {
    case '1H':
      from.setDate(from.getDate() - 1); // 1 day for hourly (will show daily data)
      break;
    case '1D':
      from.setDate(from.getDate() - 30); // 30 days
      break;
    case '1W':
      from.setDate(from.getDate() - 90); // ~3 months
      break;
    case '1M':
      from.setMonth(from.getMonth() - 12); // 1 year
      break;
    case '1Y':
      from.setFullYear(from.getFullYear() - 5); // 5 years
      break;
    default:
      from.setDate(from.getDate() - 30);
  }
  
  const fromStr = from.toISOString().split('T')[0]; // YYYY-MM-DD
  
  return { from: fromStr, to: toStr };
}

/**
 * RTK Query API Slice for EODHD
 */
export const eodhdApi = createApi({
  reducerPath: 'eodhdApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://eodhd.com/api',
  }),
  tagTypes: ['HistoricalData', 'Quote'],
  endpoints: (builder) => ({
    /**
     * Fetch historical candle data from EODHD
     * Documentation: https://eodhd.com/financial-apis/api-for-historical-data-and-volumes
     */
    getHistoricalData: builder.query<
      ChartData[],
      { symbol: string; timeframe: Timeframe }
    >({
      query: ({ symbol, timeframe }) => {
        const formattedSymbol = formatSymbol(symbol);
        const period = getPeriod(timeframe);
        const { from, to } = getDateRange(timeframe);
        
        return {
          url: `/eod/${formattedSymbol}`,
          params: {
            api_token: EODHD_API_KEY,
            from,
            to,
            period,
            fmt: 'json',
          },
        };
      },
      transformResponse: (response: any): ChartData[] => {
        // EODHD returns an array of objects
        if (!Array.isArray(response) || response.length === 0) {
          return [];
        }

        // Convert EODHD format to our ChartData format
        // EODHD format: { date: "2024-01-01", open: 100, high: 105, low: 99, close: 103, adjusted_close: 103, volume: 1000000 }
        // EODHD returns data in reverse chronological order (newest first), so we need to reverse it
        const chartData: ChartData[] = response
          .map((item: any) => ({
            timestamp: new Date(item.date).getTime(), // Convert date string to milliseconds
            value: item.close || item.adjusted_close, // Use close price as main value
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close || item.adjusted_close,
            volume: item.volume || 0,
          }))
          .reverse(); // Reverse to get chronological order (oldest first)

        return chartData;
      },
      // Cache for 5 minutes
      keepUnusedDataFor: 300,
      providesTags: (result, error, { symbol, timeframe }) => [
        { type: 'HistoricalData', id: `${symbol}-${timeframe}` },
      ],
    }),
  }),
});

// Export hooks for usage in functional components
export const { useGetHistoricalDataQuery: useGetEODHDHistoricalDataQuery } = eodhdApi;

