import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ChartData {
  timestamp: number;
  value: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export interface StockPrice {
  timestamp: number;
  price: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

interface StockDataState {
  // Real-time price data (from WebSocket)
  currentPrices: Record<string, StockPrice>;
  // Real-time chart data (from WebSocket)
  realtimeChartData: Record<string, ChartData[]>;
  // Historical chart data (from REST API, keyed by symbol-timeframe)
  // Note: Loading/error states are now handled by RTK Query
  historicalChartData: Record<string, Record<string, ChartData[]>>;
}

const initialState: StockDataState = {
  currentPrices: {},
  realtimeChartData: {},
  historicalChartData: {},
};

const stockDataSlice = createSlice({
  name: 'stockData',
  initialState,
  reducers: {
    // Real-time price updates
    updateCurrentPrice: (
      state,
      action: PayloadAction<{ symbol: string; price: StockPrice }>
    ) => {
      state.currentPrices[action.payload.symbol] = action.payload.price;
    },
    
    // Update real-time candles (processed OHLC candles from ticks)
    updateRealtimeCandles: (
      state,
      action: PayloadAction<{ symbol: string; candles: ChartData[] }>
    ) => {
      const { symbol, candles } = action.payload;
      state.realtimeChartData[symbol] = candles;
    },
    
    // Set historical chart data (from REST API)
    setHistoricalData: (
      state,
      action: PayloadAction<{
        symbol: string;
        timeframe: string;
        data: ChartData[];
      }>
    ) => {
      const { symbol, timeframe, data } = action.payload;
      if (!state.historicalChartData[symbol]) {
        state.historicalChartData[symbol] = {};
      }
      state.historicalChartData[symbol][timeframe] = data;
    },
    
    // Clear data for a symbol
    clearSymbolData: (state, action: PayloadAction<string>) => {
      const symbol = action.payload;
      delete state.currentPrices[symbol];
      delete state.realtimeChartData[symbol];
      delete state.historicalChartData[symbol];
    },
  },
});

export const {
  updateCurrentPrice,
  updateRealtimeCandles,
  setHistoricalData,
  clearSymbolData,
} = stockDataSlice.actions;

export default stockDataSlice.reducer;

