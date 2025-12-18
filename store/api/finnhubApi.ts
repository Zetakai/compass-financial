/**
 * RTK Query API Slice for Finnhub
 * 
 * Modern approach (2025): Use RTK Query instead of manual thunks
 * Benefits:
 * - Automatic caching (no duplicate requests)
 * - Automatic loading/error states
 * - Built-in polling support
 * - Less boilerplate code
 */

import { FINNHUB_API_KEY } from '@/config/api';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { ChartData } from '../slices/stockDataSlice';
import { Timeframe } from '../slices/uiSlice';

/**
 * Convert Finnhub timeframe to API resolution
 */
function getResolution(timeframe: Timeframe): string {
  switch (timeframe) {
    case '1H':
      return '1'; // 1 minute (for 1H, we'll get 60 points)
    case '1D':
      return '5'; // 5 minutes
    case '1W':
      return '15'; // 15 minutes
    case '1M':
      return 'D'; // Daily
    case '1Y':
      return 'W'; // Weekly
    default:
      return '5';
  }
}

/**
 * Calculate time range based on timeframe
 */
function getTimeRange(timeframe: Timeframe): { from: number; to: number } {
  const to = Math.floor(Date.now() / 1000); // Current time in seconds
  let from: number;

  switch (timeframe) {
    case '1H':
      from = to - 60 * 60; // 1 hour ago
      break;
    case '1D':
      from = to - 24 * 60 * 60; // 1 day ago
      break;
    case '1W':
      from = to - 7 * 24 * 60 * 60; // 1 week ago
      break;
    case '1M':
      from = to - 30 * 24 * 60 * 60; // 1 month ago
      break;
    case '1Y':
      from = to - 365 * 24 * 60 * 60; // 1 year ago
      break;
    default:
      from = to - 24 * 60 * 60;
  }

  return { from, to };
}

/**
 * RTK Query API Slice
 * This replaces manual thunks with a declarative API definition
 */
export const finnhubApi = createApi({
  reducerPath: 'finnhubApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://finnhub.io/api/v1',
  }),
  tagTypes: ['HistoricalData', 'Quote', 'CompanyProfile'],
  endpoints: (builder) => ({
    /**
     * Fetch historical candle data
     * RTK Query automatically handles:
     * - Caching (won't refetch if data exists)
     * - Loading states
     * - Error handling
     */
    getHistoricalData: builder.query<
      ChartData[],
      { symbol: string; timeframe: Timeframe }
    >({
      query: ({ symbol, timeframe }) => {
        const resolution = getResolution(timeframe);
        const { from, to } = getTimeRange(timeframe);
        
        return {
          url: '/stock/candle',
          params: {
            symbol,
            resolution,
            from,
            to,
            token: FINNHUB_API_KEY,
          },
        };
      },
      transformResponse: (response: any): ChartData[] => {
        // Handle Finnhub response format
        if (response.s === 'no_data' || response.s === 'error') {
          throw new Error(response.error || 'No data available');
        }

        if (!response.c || response.c.length === 0) {
          return [];
        }

        // Convert Finnhub OHLCV format to our ChartData format
        const chartData: ChartData[] = [];
        for (let i = 0; i < response.t.length; i++) {
          chartData.push({
            timestamp: response.t[i] * 1000, // Convert to milliseconds
            value: response.c[i], // Close price (used as main value)
            open: response.o[i],
            high: response.h[i],
            low: response.l[i],
            close: response.c[i],
            volume: response.v[i],
          });
        }

        return chartData;
      },
      // Cache for 5 minutes (historical data doesn't change often)
      keepUnusedDataFor: 300,
      providesTags: (result, error, { symbol, timeframe }) => [
        { type: 'HistoricalData', id: `${symbol}-${timeframe}` },
      ],
    }),

    /**
     * Get current quote (latest price)
     * Useful for initial load or when WebSocket is disconnected
     */
    getCurrentQuote: builder.query<
      { 
        price: number; 
        change: number; 
        percentChange: number;
        high: number; // High price of the day
        low: number; // Low price of the day
        open: number; // Open price of the day
        previousClose: number; // Previous close price
      },
      string
    >({
      query: (symbol) => ({
        url: '/quote',
        params: {
          symbol,
          token: FINNHUB_API_KEY,
        },
      }),
      transformResponse: (response: any) => {
        if (response.dp === undefined) {
          throw new Error('Invalid quote data');
        }

        return {
          price: response.c, // Current price
          change: response.d, // Change
          percentChange: response.dp, // Percent change
          high: response.h || 0, // High price of the day
          low: response.l || 0, // Low price of the day
          open: response.o || 0, // Open price of the day
          previousClose: response.pc || 0, // Previous close price
        };
      },
      // Cache for 30 seconds (quotes change frequently)
      keepUnusedDataFor: 30,
      providesTags: (result, error, symbol) => [
        { type: 'Quote', id: symbol },
      ],
    }),

    /**
     * Get company profile (includes market cap, logo, description, sector, industry)
     */
    getCompanyProfile: builder.query<
      { 
        marketCap: number; 
        name: string; 
        exchange: string; 
        currency: string; 
        logo: string;
        industry?: string;
        website?: string;
        phone?: string;
        country?: string;
      },
      string
    >({
      query: (symbol) => ({
        url: '/stock/profile2',
        params: {
          symbol,
          token: FINNHUB_API_KEY,
        },
      }),
      transformResponse: (response: any) => {
        // Finnhub returns marketCapitalization in millions, convert to raw value
        const marketCapRaw = response.marketCapitalization || 0;
        const marketCap = marketCapRaw * 1e6; // Convert millions to raw value
        
        return {
          marketCap,
          name: response.name || '',
          exchange: response.exchange || '',
          currency: response.currency || 'USD',
          logo: response.logo || '',
          // Only include fields that actually exist in the API response
          industry: response.finnhubIndustry || '',
          website: response.weburl || '',
          phone: response.phone || '',
          country: response.country || '',
        };
      },
      // Cache for 1 hour (company profile doesn't change often)
      keepUnusedDataFor: 3600,
      providesTags: (result, error, symbol) => [
        { type: 'CompanyProfile', id: symbol },
      ],
    }),
  }),
});

// Export hooks for usage in functional components
export const { 
  useGetHistoricalDataQuery, 
  useGetCurrentQuoteQuery,
  useGetCompanyProfileQuery 
} = finnhubApi;

