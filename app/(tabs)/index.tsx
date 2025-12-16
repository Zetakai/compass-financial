import { useColorScheme } from '@/components/useColorScheme';
import { API_PROVIDER, DEFAULT_SYMBOLS, EODHD_API_KEY, FINNHUB_API_KEY } from '@/config/api';
import Colors from '@/constants/Colors';
import { getEODHDWebSocket } from '@/services/eodhdWebSocket';
import { getFinnhubWebSocket, StockPrice } from '@/services/finnhubWebSocket';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { LineChart, LineChartProvider } from 'react-native-wagmi-charts';

interface ChartData {
  timestamp: number;
  value: number;
}

type Timeframe = '1H' | '1D' | '1W' | '1M' | '1Y';

export default function StockPricesScreen() {
  const colorScheme = useColorScheme();
  const [selectedSymbol, setSelectedSymbol] = useState<string>(DEFAULT_SYMBOLS[0]);
  const [symbolInput, setSymbolInput] = useState<string>('');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [customSymbols, setCustomSymbols] = useState<string[]>([]);
  const [priceData, setPriceData] = useState<Map<string, ChartData[]>>(new Map());
  const [currentPrices, setCurrentPrices] = useState<Map<string, StockPrice>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = Colors[colorScheme ?? 'light'];
  const allSymbols = [...DEFAULT_SYMBOLS, ...customSymbols];

  // Initialize WebSocket connection
  useEffect(() => {
    // Select provider based on config
    const ws = API_PROVIDER === 'finnhub' 
      ? getFinnhubWebSocket(FINNHUB_API_KEY)
      : getEODHDWebSocket(EODHD_API_KEY);

    // Check if API key is provided
    if (API_PROVIDER === 'finnhub' && !FINNHUB_API_KEY) {
      setError('Finnhub API key is required. Get your free key at https://finnhub.io/');
      setIsLoading(false);
      return;
    }

    ws.onConnect(() => {
      setIsConnected(true);
      setIsLoading(false);
      setError(null);
    });

    ws.onError((err) => {
      setError(err.message);
      setIsLoading(false);
      setIsConnected(false);
    });

    // Subscribe to all default symbols
    ws.connect(DEFAULT_SYMBOLS)
      .then(() => {
        // Subscribe to price updates for each symbol
        DEFAULT_SYMBOLS.forEach((symbol) => {
          ws.onPriceUpdate(symbol, (data: StockPrice) => {
            setCurrentPrices((prev) => {
              const newMap = new Map(prev);
              newMap.set(symbol, data);
              return newMap;
            });

            setPriceData((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(symbol) || [];
              
              // Add new data point
              const newData: ChartData = {
                timestamp: data.timestamp,
                value: data.price,
              };

              // Keep only last 100 data points for performance
              const updated = [...existing, newData].slice(-100);
              newMap.set(symbol, updated);
              return newMap;
            });
          });
        });
      })
      .catch((err) => {
        setError(err.message || 'Failed to connect to WebSocket');
        setIsLoading(false);
      });

    return () => {
      ws.disconnect();
    };
  }, []);

  // Add new symbol
  const handleAddSymbol = useCallback(() => {
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) {
      return;
    }

    // Check if symbol already exists
    if (allSymbols.includes(symbol)) {
      setSelectedSymbol(symbol);
      setSymbolInput('');
      return;
    }

    const ws = API_PROVIDER === 'finnhub' 
      ? getFinnhubWebSocket(FINNHUB_API_KEY)
      : getEODHDWebSocket(EODHD_API_KEY);
      
    if (ws.isConnected()) {
      // Add to custom symbols list
      setCustomSymbols((prev) => [...prev, symbol]);
      
      ws.connect([symbol])
        .then(() => {
          ws.onPriceUpdate(symbol, (data: StockPrice) => {
            setCurrentPrices((prev) => {
              const newMap = new Map(prev);
              newMap.set(symbol, data);
              return newMap;
            });

            setPriceData((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(symbol) || [];
              const newData: ChartData = {
                timestamp: data.timestamp,
                value: data.price,
              };
              const updated = [...existing, newData].slice(-100);
              newMap.set(symbol, updated);
              return newMap;
            });
          });
          setSelectedSymbol(symbol);
          setSymbolInput('');
        })
        .catch((err) => {
          console.error('Failed to add symbol:', err);
          setError(`Failed to add symbol ${symbol}. Please check if it's valid.`);
        });
    } else {
      setError('WebSocket not connected. Please wait for connection.');
    }
  }, [symbolInput, allSymbols]);

  // Filter chart data based on timeframe
  // Note: Financial apps typically use REST API for historical data (hourly/daily/monthly/yearly)
  // and WebSocket for real-time updates. This implementation filters real-time data.
  // For production, consider fetching historical data from REST API endpoints.
  const getFilteredChartData = (): ChartData[] => {
    const allData = priceData.get(selectedSymbol) || [];
    if (allData.length === 0) return [];
    
    const now = Date.now();
    let cutoffTime: number;
    
    switch (timeframe) {
      case '1H':
        cutoffTime = now - 60 * 60 * 1000; // 1 hour
        break;
      case '1D':
        cutoffTime = now - 24 * 60 * 60 * 1000; // 1 day
        break;
      case '1W':
        cutoffTime = now - 7 * 24 * 60 * 60 * 1000; // 1 week
        break;
      case '1M':
        cutoffTime = now - 30 * 24 * 60 * 60 * 1000; // 1 month
        break;
      case '1Y':
        cutoffTime = now - 365 * 24 * 60 * 60 * 1000; // 1 year
        break;
      default:
        return allData;
    }
    
    return allData.filter((point) => point.timestamp >= cutoffTime);
  };

  const chartData = getFilteredChartData();
  const currentPrice = currentPrices.get(selectedSymbol);

  // Calculate price change
  const getPriceChange = () => {
    if (chartData.length < 2) return { value: 0, percent: 0 };
    const current = chartData[chartData.length - 1]?.value || 0;
    const previous = chartData[0]?.value || current;
    const change = current - previous;
    const percent = previous !== 0 ? (change / previous) * 100 : 0;
    return { value: change, percent };
  };

  const priceChange = getPriceChange();
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
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              Make sure you have a valid EODHD API key in config/api.ts
            </Text>
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
                      ? (colorScheme === 'dark' ? '#2f95dc' : colors.tint)
                      : 'transparent',
                  borderColor: colorScheme === 'dark' ? '#2f95dc' : colors.tint,
                },
              ]}
              onPress={() => setSelectedSymbol(symbol)}
            >
              <Text
                style={[
                  styles.symbolButtonText,
                  {
                    color:
                      selectedSymbol === symbol 
                        ? '#FFFFFF' 
                        : (colorScheme === 'dark' ? '#fff' : colors.text),
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
              }
            ]}
            onPress={handleAddSymbol}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Current Price Display */}
        {currentPrice && (
          <View style={styles.priceContainer}>
            <Text style={[styles.symbolName, { color: colors.text }]}>
              {selectedSymbol}
            </Text>
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
                        ? (colorScheme === 'dark' ? '#2f95dc' : colors.tint)
                        : 'transparent',
                    borderColor: colorScheme === 'dark' ? '#2f95dc' : colors.tint,
                  },
                ]}
                onPress={() => setTimeframe(tf)}
              >
                <Text
                  style={[
                    styles.timeframeButtonText,
                    {
                      color:
                        timeframe === tf 
                          ? '#FFFFFF' 
                          : (colorScheme === 'dark' ? '#fff' : colors.text),
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
        {chartData.length > 0 ? (
          <View style={styles.chartContainer}>
            <LineChartProvider data={chartData} key={`${selectedSymbol}-${timeframe}`}>
              <LineChart height={300}>
                <LineChart.Path
                  color={isPositive ? '#4CAF50' : '#F44336'}
                  width={2}
                >
                  <LineChart.Gradient />
                </LineChart.Path>
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
              Waiting for price data...
            </Text>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: colors.text + '80' }]}>
            Real-time stock prices powered by {API_PROVIDER === 'finnhub' ? 'Finnhub' : 'EODHD'} WebSocket API
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
    marginBottom: 4,
  },
  errorHint: {
    color: '#C62828',
    fontSize: 12,
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
