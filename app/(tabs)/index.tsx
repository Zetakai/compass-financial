import { useColorScheme } from '@/components/useColorScheme';
import { API_PROVIDER, DEFAULT_SYMBOLS, EODHD_API_KEY, FINNHUB_API_KEY } from '@/config/api';
import Colors from '@/constants/Colors';
import { getEODHDWebSocket } from '@/services/eodhdWebSocket';
import { getFinnhubWebSocket, StockPrice } from '@/services/finnhubWebSocket';
import { useGetHistoricalDataQuery } from '@/store/api/finnhubApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  ChartData,
  setHistoricalData,
  updateCurrentPrice,
  updateRealtimeCandles,
} from '@/store/slices/stockDataSlice';
import {
  addCustomSymbol,
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart, LineChartProvider } from 'react-native-wagmi-charts';

export default function StockPricesScreen() {
  const colorScheme = useColorScheme();
  const dispatch = useAppDispatch();
  const [symbolInput, setSymbolInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Redux state
  const selectedSymbol = useAppSelector((state) => state.ui.selectedSymbol);
  const timeframe = useAppSelector((state) => state.ui.timeframe);
  const customSymbols = useAppSelector((state) => state.ui.customSymbols);
  const isConnected = useAppSelector((state) => state.ui.isConnected);
  const isLoading = useAppSelector((state) => state.ui.isLoading);
  const currentPrices = useAppSelector((state) => state.stockData.currentPrices);
  const realtimeChartData = useAppSelector((state) => state.stockData.realtimeChartData);
  const historicalChartData = useAppSelector((state) => state.stockData.historicalChartData);

  const colors = Colors[colorScheme ?? 'light'];
  const allSymbols = [...DEFAULT_SYMBOLS, ...customSymbols];
  const currentPrice = currentPrices[selectedSymbol];

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
  const {
    data: historicalDataFromQuery,
    isLoading: isLoadingHistorical,
    error: historicalError,
  } = useGetHistoricalDataQuery(
    { symbol: selectedSymbol, timeframe },
    {
      skip: !isConnected || API_PROVIDER !== 'finnhub' || !FINNHUB_API_KEY,
      // Refetch when symbol or timeframe changes
    }
  );

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
  // This provides real-time price ticks that update the last candle or create new ones
  useEffect(() => {
    const ws =
      API_PROVIDER === 'finnhub'
        ? getFinnhubWebSocket(FINNHUB_API_KEY)
        : getEODHDWebSocket(EODHD_API_KEY);

    if (API_PROVIDER === 'finnhub' && !FINNHUB_API_KEY) {
      setErrorMessage('Finnhub API key is required. Get your free key at https://finnhub.io/');
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
  }, [allSymbols.join(','), timeframe, historicalChartData, realtimeChartData, dispatch]);

  // Add new symbol
  const handleAddSymbol = useCallback(() => {
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) {
      return;
    }

    if (allSymbols.includes(symbol)) {
      dispatch(setSelectedSymbol(symbol));
      setSymbolInput('');
      return;
    }

    const ws =
      API_PROVIDER === 'finnhub'
        ? getFinnhubWebSocket(FINNHUB_API_KEY)
        : getEODHDWebSocket(EODHD_API_KEY);

    if (ws.isConnected()) {
      dispatch(addCustomSymbol(symbol));
      ws.connect([symbol])
        .then(() => {
          ws.onPriceUpdate(symbol, (tick: StockPrice) => {
            // Update current price
            dispatch(updateCurrentPrice({ symbol, price: tick }));

            // Get the last historical timestamp
            const historical = historicalChartData[symbol]?.[timeframe] || [];
            const lastHistoricalTimestamp =
              historical.length > 0 ? historical[historical.length - 1].timestamp : undefined;

            // Get current real-time candles
            const currentRealtime = realtimeChartData[symbol] || [];

            // Update candles with new tick
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

            // Update Redux
            dispatch(updateRealtimeCandles({ symbol, candles: updatedCandles }));
          });
          
          // Historical data will be fetched automatically by RTK Query
          // when we set the selected symbol (via useGetHistoricalDataQuery)
          
          dispatch(setSelectedSymbol(symbol));
          setSymbolInput('');
        })
        .catch((err) => {
          console.error('Failed to add symbol:', err);
          setErrorMessage(`Failed to add symbol ${symbol}. Please check if it's valid.`);
        });
    } else {
      setErrorMessage('WebSocket not connected. Please wait for connection.');
    }
  }, [symbolInput, allSymbols, dispatch]);

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

        {/* Add Symbol Input */}
        <View style={styles.addSymbolContainer}>
          <TextInput
            style={[
              styles.symbolInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.tint,
                color: colors.text,
              },
            ]}
            placeholder="Add symbol (e.g., NVDA)"
            placeholderTextColor={colors.text + '80'}
            value={symbolInput}
            onChangeText={setSymbolInput}
            onSubmitEditing={handleAddSymbol}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[
              styles.addButton,
              {
                backgroundColor: colorScheme === 'dark' ? '#2f95dc' : colors.tint,
              },
            ]}
            onPress={handleAddSymbol}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

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
              Error loading historical data: {historicalError.toString()}
            </Text>
          </View>
        ) : chartData.length > 0 ? (
          <View style={styles.chartContainer}>
            <LineChartProvider data={chartData} key={`${selectedSymbol}-${timeframe}`}>
              <LineChart height={300}>
                {/* Y-Axis (Price) */}
                <LineChart.Axis
                  position="left"
                  orientation="vertical"
                  color={colorScheme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                  textStyle={{
                    color: colors.text + '80',
                    fontSize: 10,
                  }}
                  tickCount={5}
                />

                {/* X-Axis (Time) */}
                <LineChart.Axis
                  position="bottom"
                  orientation="horizontal"
                  color={colorScheme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                  textStyle={{
                    color: colors.text + '80',
                    fontSize: 10,
                  }}
                  tickCount={5}
                />

                {/* Chart Path */}
                <LineChart.Path
                  color={isPositive ? '#4CAF50' : '#F44336'}
                  width={2}
                >
                  <LineChart.Gradient />
                </LineChart.Path>

                {/* Cursor and Tooltip */}
                <LineChart.CursorCrosshair color={colors.tint}>
                  <LineChart.Tooltip
                    textStyle={{
                      color: colors.text,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                    style={{
                      backgroundColor: colors.background,
                      borderColor: colors.tint,
                      borderWidth: 1,
                      borderRadius: 8,
                      padding: 8,
                    }}
                  />
                </LineChart.CursorCrosshair>
              </LineChart>

              {/* Price and Time Display */}
              <View style={styles.chartPriceContainer}>
                <LineChart.PriceText
                  style={[styles.chartPriceText, { color: colors.text }]}
                />
                <LineChart.DatetimeText
                  style={[styles.chartTimeText, { color: colors.text + '80' }]}
                  options={{
                    hour: '2-digit',
                    minute: '2-digit',
                    month: 'short',
                    day: 'numeric',
                  }}
                />
              </View>
            </LineChartProvider>
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
            {API_PROVIDER === 'finnhub'
              ? 'Get your free API key at: https://finnhub.io/'
              : 'Get your API key at: https://eodhistoricaldata.com/'}
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
  addSymbolContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  symbolInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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
    padding: 16,
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
