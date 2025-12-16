import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_SYMBOLS } from '@/config/api';

export type Timeframe = '1H' | '1D' | '1W' | '1M' | '1Y';

interface UIState {
  selectedSymbol: string;
  timeframe: Timeframe;
  customSymbols: string[];
  isConnected: boolean;
  isLoading: boolean;
}

const initialState: UIState = {
  selectedSymbol: DEFAULT_SYMBOLS[0] || 'AAPL',
  timeframe: '1D',
  customSymbols: [],
  isConnected: false,
  isLoading: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSelectedSymbol: (state, action: PayloadAction<string>) => {
      state.selectedSymbol = action.payload;
    },
    setTimeframe: (state, action: PayloadAction<Timeframe>) => {
      state.timeframe = action.payload;
    },
    addCustomSymbol: (state, action: PayloadAction<string>) => {
      if (!state.customSymbols.includes(action.payload)) {
        state.customSymbols.push(action.payload);
      }
    },
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  setSelectedSymbol,
  setTimeframe,
  addCustomSymbol,
  setConnectionStatus,
  setLoading,
} = uiSlice.actions;

export default uiSlice.reducer;

