import { configureStore } from '@reduxjs/toolkit';
import { eodhdApi } from './api/eodhdApi';
import { finnhubApi } from './api/finnhubApi';
import stockDataReducer from './slices/stockDataSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    stockData: stockDataReducer,
    ui: uiReducer,
    // Add RTK Query API reducers
    [finnhubApi.reducerPath]: finnhubApi.reducer,
    [eodhdApi.reducerPath]: eodhdApi.reducer,
  },
  // Add RTK Query middleware for caching and invalidation
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(finnhubApi.middleware, eodhdApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

