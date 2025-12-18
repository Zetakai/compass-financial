import TradingViewChart from '@/components/TradingViewChart';
import { useColorScheme } from '@/components/useColorScheme';
import { DEFAULT_SYMBOLS, EODHD_API_KEY, FINNHUB_API_KEY } from '@/config/api';
import Colors from '@/constants/Colors';
import { useGetEODHDHistoricalDataQuery } from '@/store/api/eodhdApi';
import { useGetCurrentQuoteQuery } from '@/store/api/finnhubApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  ChartData,
  setHistoricalData,
  updateCurrentPrice,
} from '@/store/slices/stockDataSlice';
import {
  setSelectedSymbol,
  Timeframe
} from '@/store/slices/uiSlice';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function ChartTab() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const colorScheme = useColorScheme();
  const dispatch = useAppDispatch();
  const colors = Colors[colorScheme ?? 'light'];

  // Use the symbol from URL params, fallback to Redux selected symbol
  const stockSymbol = symbol || DEFAULT_SYMBOLS[0];
  const [timeframe, setTimeframeState] = useState<Timeframe>('1D');

  // Redux state
  const currentPrices = useAppSelector((state) => state.stockData.currentPrices);
  const historicalChartData = useAppSelector(
    (state) => state.stockData.historicalChartData
  );

  const navigation = useNavigation();

  // Set selected symbol in Redux when component mounts
  useEffect(() => {
    dispatch(setSelectedSymbol(stockSymbol));
  }, [stockSymbol, dispatch]);

  // Update navigation title with stock symbol
  useEffect(() => {
    navigation.setOptions({
      title: stockSymbol,
      headerBackTitle: 'Stocks',
      headerTitle: stockSymbol,
    });
  }, [stockSymbol, navigation]);

  // Historical data (REST API)
  const historicalData = useMemo((): ChartData[] => {
    return historicalChartData[stockSymbol]?.[timeframe] || [];
  }, [stockSymbol, timeframe, historicalChartData]);

  // Fetch current quote using REST API (polling every 30 seconds)
  const {
    data: currentQuote,
    isLoading: isLoadingQuote,
  } = useGetCurrentQuoteQuery(stockSymbol, {
    skip: !stockSymbol || !FINNHUB_API_KEY,
    pollingInterval: 30000, // Poll every 30 seconds
  });

  // Latest real-time tick (from REST API quote)
  const latestRealtimeTick = useMemo(() => {
    if (!currentQuote) return undefined;
    
    const lastHistoricalTimestamp =
      historicalData.length > 0 ? historicalData[historicalData.length - 1].timestamp : undefined;
    const quoteTimestamp = Date.now();

    // Only show if quote is newer than last historical data point
    if (lastHistoricalTimestamp && quoteTimestamp <= lastHistoricalTimestamp) {
      return undefined;
    }

    return {
      timestamp: quoteTimestamp,
      price: currentQuote.price,
    };
  }, [currentQuote, historicalData]);

  // Load historical data
  const {
    data: eodhdHistoricalData,
    isLoading: isLoadingEODHD,
    error: eodhdError,
  } = useGetEODHDHistoricalDataQuery(
    { symbol: stockSymbol, timeframe },
    {
      skip: !EODHD_API_KEY,
    }
  );

  // Process historical data when it arrives
  useEffect(() => {
    if (eodhdHistoricalData) {
      dispatch(
        setHistoricalData({
          symbol: stockSymbol,
          timeframe,
          data: eodhdHistoricalData,
        })
      );
    }
  }, [eodhdHistoricalData, stockSymbol, timeframe, dispatch]);

  // Update current price from REST API quote
  useEffect(() => {
    if (currentQuote && stockSymbol) {
      dispatch(
        updateCurrentPrice({
          symbol: stockSymbol,
          price: {
            timestamp: Date.now(),
            price: currentQuote.price,
            volume: 0,
          },
        })
      );
    }
  }, [currentQuote, stockSymbol, dispatch]);

  // Calculate price change
  const priceChange = useMemo(() => {
    if (historicalData.length < 2) return { value: 0, percent: 0 };
    const current = currentPrices[stockSymbol]?.price || historicalData[historicalData.length - 1]?.value || 0;
    const previous = historicalData[0]?.value || current;
    const change = current - previous;
    const percent = previous !== 0 ? (change / previous) * 100 : 0;
    return { value: change, percent };
  }, [historicalData, currentPrices, stockSymbol]);

  const isPositive = priceChange.value >= 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Chart - Fullscreen */}
      {isLoadingEODHD ? (
        <View style={styles.noDataContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.noDataText, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }]}>
            Loading {timeframe} data...
          </Text>
        </View>
      ) : eodhdError ? (
        <View style={styles.noDataContainer}>
          <Text style={[styles.noDataText, { color: '#F44336', fontWeight: '600' }]}>
            Error loading chart data
          </Text>
        </View>
      ) : historicalData.length > 0 ? (
        <View style={styles.chartContainer}>
          <TradingViewChart
            data={historicalData}
            realtimeTick={latestRealtimeTick}
            height={undefined}
            timeframe={timeframe}
            isPositive={isPositive}
            symbol={stockSymbol}
          />
        </View>
      ) : (
        <View style={styles.noDataContainer}>
          <Text style={[styles.noDataText, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }]}>
            Waiting for chart data...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chartContainer: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
});

