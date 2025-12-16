import TradingViewChart from '@/components/TradingViewChart';
import { useColorScheme } from '@/components/useColorScheme';
import { DEFAULT_SYMBOLS, EODHD_API_KEY, FINNHUB_API_KEY } from '@/config/api';
import Colors from '@/constants/Colors';
import { getFinnhubWebSocket, StockPrice } from '@/services/finnhubWebSocket';
import { useGetEODHDHistoricalDataQuery } from '@/store/api/eodhdApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  ChartData,
  setHistoricalData,
  updateCurrentPrice,
  updateRealtimeCandles,
} from '@/store/slices/stockDataSlice';
import {
  setConnectionStatus,
  setLoading,
  setSelectedSymbol,
  setTimeframe,
  Timeframe,
} from '@/store/slices/uiSlice';
import {
  mergeHistoricalAndRealtime,
  updateCandleWithTick,
} from '@/utils/candleUtils';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function StockPricesScreen() {
  const colorScheme = useColorScheme();
  const dispatch = useAppDispatch();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Redux state
  const selectedSymbol = useAppSelector((state) => state.ui.selectedSymbol);
  const timeframe = useAppSelector((state) => state.ui.timeframe);
  const isConnected = useAppSelector((state) => state.ui.isConnected);
  const isLoading = useAppSelector((state) => state.ui.isLoading);
  const currentPrices = useAppSelector((state) => state.stockData.currentPrices);
  const realtimeChartData = useAppSelector((state) => state.stockData.realtimeChartData);
  const historicalChartData = useAppSelector((state) => state.stockData.historicalChartData);

  const colors = Colors[colorScheme ?? 'light'];
  const allSymbols = DEFAULT_SYMBOLS;
  const currentPrice = currentPrices[selectedSymbol];

  // Get date format options based on timeframe for X-axis
  const getDateFormatOptions = (tf: Timeframe): Intl.DateTimeFormatOptions => {
    switch (tf) {
      case '1H':
        return {
          hour: '2-digit',
          minute: '2-digit',
        };
      case '1D':
        return {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
        };
      case '1W':
        return {
          month: 'short',
          day: 'numeric',
        };
      case '1M':
        return {
          month: 'short',
          day: 'numeric',
          year: '2-digit',
        };
      case '1Y':
        return {
          month: 'short',
          year: 'numeric',
        };
      default:
        return {
          month: 'short',
          day: 'numeric',
        };
    }
  };

  // Helper to extract error message from RTK Query error
  const getErrorMessage = (error: any): string => {
    if (!error) return 'Unknown error';
    
    // RTK Query error structure
    if (error.status) {
      // HTTP error
      if (error.data) {
        if (typeof error.data === 'string') return error.data;
        if (error.data.error) return error.data.error;
        if (error.data.message) return error.data.message;
      }
      return `HTTP ${error.status}: ${error.error || 'Request failed'}`;
    }
    
    // Network or other errors
    if (error.error) return error.error;
    if (error.message) return error.message;
    
    return 'Failed to load historical data';
  };

  // Get combined chart data: Historical + Real-time
  // This is Step C: The Merge - Hybrid Architecture
  // REST API provides historical candles (the snapshot)
  // WebSocket provides real-time ticks (the live pulse)
  const chartData = useMemo((): ChartData[] => {
    const historical = historicalChartData[selectedSymbol]?.[timeframe] || [];
    const realtime = realtimeChartData[selectedSymbol] || [];

    if (historical.length === 0 && realtime.length === 0) {
      return [];
    }

    // Use candle utils to properly merge historical and real-time data
    // This handles OHLC candle updates and prevents gaps/duplicates
    return mergeHistoricalAndRealtime(historical, realtime, timeframe);
  }, [selectedSymbol, timeframe, historicalChartData, realtimeChartData]);

  // Step A: Load Historical Data (REST API) using RTK Query
  // RTK Query automatically handles:
  // - Caching (won't refetch if data exists)
  // - Loading states
  // - Error handling
  // - No manual thunks needed!
  
  // Use EODHD for historical data (REST API)
  const {
    data: eodhdHistoricalData,
    isLoading: isLoadingEODHD,
    error: eodhdError,
  } = useGetEODHDHistoricalDataQuery(
    { symbol: selectedSymbol, timeframe },
    {
      skip: !isConnected || !EODHD_API_KEY,
    }
  );

  // Combine loading and error states
  const isLoadingHistorical = isLoadingEODHD;
  const historicalError = eodhdError;
  const historicalDataFromQuery = eodhdHistoricalData;

  // Stable key for chart - only remount when symbol or timeframe changes
  // Using a simpler key to prevent viewstate errors during rapid timeframe changes
  const chartKey = useMemo(() => {
    return `${selectedSymbol}-${timeframe}`;
  }, [selectedSymbol, timeframe]);

  // Track if we should show the chart (prevent rendering during data transitions)
  const shouldShowChart = useMemo(() => {
    // Don't show chart if we're loading new historical data
    if (isLoadingHistorical) return false;
    // Don't show chart if there's an error
    if (historicalError) return false;
    // Only show if we have data
    return chartData.length > 0;
  }, [isLoadingHistorical, historicalError, chartData.length]);

  // Store RTK Query data in our slice for merging with real-time data
  useEffect(() => {
    if (historicalDataFromQuery) {
      dispatch(
        setHistoricalData({
          symbol: selectedSymbol,
          timeframe,
          data: historicalDataFromQuery,
        })
      );
    }
  }, [historicalDataFromQuery, selectedSymbol, timeframe, dispatch]);

  // Step B: Initialize WebSocket Connection (Live Pulse)
  // Use Finnhub WebSocket for real-time data
  useEffect(() => {
    const ws = getFinnhubWebSocket(FINNHUB_API_KEY);

    if (!FINNHUB_API_KEY) {
      setErrorMessage('Finnhub API key is required for WebSocket. Get your free key at https://finnhub.io/');
      dispatch(setLoading(false));
      return;
    }

    ws.onConnect(() => {
      dispatch(setConnectionStatus(true));
      dispatch(setLoading(false));
      setErrorMessage(null);
    });

    ws.onError((err) => {
      setErrorMessage(err.message);
      dispatch(setLoading(false));
      dispatch(setConnectionStatus(false));
    });

    // Subscribe to all symbols
    ws.connect(allSymbols)
      .then(() => {
        allSymbols.forEach((symbol) => {
          ws.onPriceUpdate(symbol, (tick: StockPrice) => {
            // Update current price (for display)
            dispatch(updateCurrentPrice({ symbol, price: tick }));

            // Get the last historical timestamp to prevent duplicates
            const historical = historicalChartData[symbol]?.[timeframe] || [];
            const lastHistoricalTimestamp =
              historical.length > 0 ? historical[historical.length - 1].timestamp : undefined;

            // Get current real-time candles
            const currentRealtime = realtimeChartData[symbol] || [];

            // Update candles with new tick (OHLC logic)
            const updatedCandles = updateCandleWithTick(
              currentRealtime,
              {
                timestamp: tick.timestamp,
                price: tick.price,
                volume: tick.volume,
              },
              timeframe,
              lastHistoricalTimestamp
            );

            // Update Redux with processed candles
            dispatch(updateRealtimeCandles({ symbol, candles: updatedCandles }));
          });
        });
      })
      .catch((err) => {
        setErrorMessage(err.message || 'Failed to connect to WebSocket');
        dispatch(setLoading(false));
      });

    return () => {
      ws.disconnect();
    };
    // Only reconnect when symbols change, NOT when timeframe changes
    // Timeframe only affects historical data (REST API), not WebSocket
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSymbols.join(','), FINNHUB_API_KEY]);


  // Calculate price change
  const priceChange = useMemo(() => {
    if (chartData.length < 2) return { value: 0, percent: 0 };
    const current = chartData[chartData.length - 1]?.value || 0;
    const previous = chartData[0]?.value || current;
    const change = current - previous;
    const percent = previous !== 0 ? (change / previous) * 100 : 0;
    return { value: change, percent };
  }, [chartData]);

  const isPositive = priceChange.value >= 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Stock Prices</Text>
          <View style={styles.connectionStatus}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isConnected ? '#4CAF50' : '#F44336' },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.text }]}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>

        {/* Error Message */}
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Connecting to WebSocket...
            </Text>
          </View>
        )}

        {/* Symbol Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.symbolSelector}
          contentContainerStyle={styles.symbolSelectorContent}
        >
          {allSymbols.map((symbol) => (
            <TouchableOpacity
              key={symbol}
              style={[
                styles.symbolButton,
                selectedSymbol === symbol && styles.symbolButtonActive,
                {
                  backgroundColor:
                    selectedSymbol === symbol
                      ? colorScheme === 'dark'
                        ? '#2f95dc'
                        : colors.tint
                      : 'transparent',
                  borderColor: colorScheme === 'dark' ? '#2f95dc' : colors.tint,
                },
              ]}
              onPress={() => dispatch(setSelectedSymbol(symbol))}
            >
              <Text
                style={[
                  styles.symbolButtonText,
                  {
                    color:
                      selectedSymbol === symbol
                        ? '#FFFFFF'
                        : colorScheme === 'dark'
                          ? '#fff'
                          : colors.text,
                  },
                ]}
              >
                {symbol}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Current Price Display */}
        {currentPrice && (
          <View style={styles.priceContainer}>
            <Text style={[styles.symbolName, { color: colors.text }]}>{selectedSymbol}</Text>
            <Text style={[styles.price, { color: colors.text }]}>
              ${currentPrice.price.toFixed(2)}
            </Text>
            <View style={styles.changeContainer}>
              <Text
                style={[
                  styles.changeText,
                  { color: isPositive ? '#4CAF50' : '#F44336' },
                ]}
              >
                {isPositive ? '+' : ''}
                {priceChange.value.toFixed(2)} ({isPositive ? '+' : ''}
                {priceChange.percent.toFixed(2)}%)
              </Text>
            </View>
            {currentPrice.volume && (
              <Text style={[styles.volume, { color: colors.text + '80' }]}>
                Volume: {currentPrice.volume.toLocaleString()}
              </Text>
            )}
          </View>
        )}

        {/* Timeframe Selector */}
        <View style={styles.timeframeContainer}>
          <Text style={[styles.timeframeLabel, { color: colors.text }]}>Timeframe:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timeframeSelector}
          >
            {(['1H', '1D', '1W', '1M', '1Y'] as Timeframe[]).map((tf) => (
              <TouchableOpacity
                key={tf}
                style={[
                  styles.timeframeButton,
                  timeframe === tf && styles.timeframeButtonActive,
                  {
                    backgroundColor:
                      timeframe === tf
                        ? colorScheme === 'dark'
                          ? '#2f95dc'
                          : colors.tint
                        : 'transparent',
                    borderColor: colorScheme === 'dark' ? '#2f95dc' : colors.tint,
                  },
                ]}
                onPress={() => dispatch(setTimeframe(tf))}
              >
                <Text
                  style={[
                    styles.timeframeButtonText,
                    {
                      color:
                        timeframe === tf
                          ? '#FFFFFF'
                          : colorScheme === 'dark'
                            ? '#fff'
                            : colors.text,
                    },
                  ]}
                >
                  {tf}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Chart */}
        {isLoadingHistorical ? (
          <View style={styles.noDataContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <Text style={[styles.noDataText, { color: colors.text + '80', marginTop: 12 }]}>
              Loading {timeframe} data...
            </Text>
          </View>
        ) : historicalError ? (
          <View style={styles.noDataContainer}>
            <Text style={[styles.noDataText, { color: '#F44336' }]}>
              Error loading historical data: {getErrorMessage(historicalError)}
            </Text>
          </View>
        ) : shouldShowChart && chartData.length > 0 ? (
          <View style={styles.chartContainer} key={chartKey}>
            <TradingViewChart
              data={chartData}
              height={300}
              timeframe={timeframe}
              isPositive={isPositive}
            />
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={[styles.noDataText, { color: colors.text + '80' }]}>
              {isConnected
                ? 'Waiting for price data...'
                : 'Connect to WebSocket to see real-time data'}
            </Text>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: colors.text + '80' }]}>
            Real-time: WebSocket | Historical: REST API (like CoinGecko, TradingView)
          </Text>
          <Text style={[styles.infoText, { color: colors.text + '80' }]}>
            Historical: EODHD | Real-time: Finnhub WebSocket
          </Text>
          <Text style={[styles.infoText, { color: colors.text + '80' }]}>
            Get EODHD key: https://eodhistoricaldata.com/ | Get Finnhub key: https://finnhub.io/
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 12,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  symbolSelector: {
    marginBottom: 16,
  },
  symbolSelectorContent: {
    gap: 8,
  },
  symbolButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  symbolButtonActive: {
    borderWidth: 0,
  },
  symbolButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  symbolName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  changeContainer: {
    marginBottom: 8,
  },
  changeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  volume: {
    fontSize: 12,
    marginTop: 4,
  },
  chartContainer: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 0,
  },
  chartPriceContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  chartPriceText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  chartTimeText: {
    fontSize: 12,
    marginTop: 4,
  },
  timeframeContainer: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeframeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeframeSelector: {
    gap: 8,
    flexDirection: 'row',
  },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  timeframeButtonActive: {
    borderWidth: 0,
  },
  timeframeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noDataContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  noDataText: {
    fontSize: 14,
  },
  infoContainer: {
    marginTop: 8,
    marginBottom: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
});
