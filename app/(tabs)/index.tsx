import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LineChart, LineChartProvider } from 'react-native-wagmi-charts';
import { getEODHDWebSocket, StockPrice } from '@/services/eodhdWebSocket';
import { EODHD_API_KEY, DEFAULT_SYMBOLS } from '@/config/api';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

interface ChartData {
  timestamp: number;
  value: number;
}

export default function StockPricesScreen() {
  const colorScheme = useColorScheme();
  const [selectedSymbol, setSelectedSymbol] = useState<string>(DEFAULT_SYMBOLS[0]);
  const [symbolInput, setSymbolInput] = useState<string>('');
  const [priceData, setPriceData] = useState<Map<string, ChartData[]>>(new Map());
  const [currentPrices, setCurrentPrices] = useState<Map<string, StockPrice>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = Colors[colorScheme ?? 'light'];

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = getEODHDWebSocket(EODHD_API_KEY);

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
    if (!symbol || DEFAULT_SYMBOLS.includes(symbol)) {
      return;
    }

    const ws = getEODHDWebSocket(EODHD_API_KEY);
    if (ws.isConnected()) {
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
          setSymbolInput('');
        })
        .catch(console.error);
    }
  }, [symbolInput]);

  const chartData = priceData.get(selectedSymbol) || [];
  const currentPrice = currentPrices.get(selectedSymbol);

  // Calculate price change
  const getPriceChange = () => {
    if (chartData.length < 2) return { value: 0, percent: 0 };
    const current = chartData[chartData.length - 1]?.value || 0;
    const previous = chartData[chartData.length - 2]?.value || current;
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
          {DEFAULT_SYMBOLS.map((symbol) => (
            <TouchableOpacity
              key={symbol}
              style={[
                styles.symbolButton,
                selectedSymbol === symbol && styles.symbolButtonActive,
                {
                  backgroundColor:
                    selectedSymbol === symbol ? colors.tint : colors.background,
                  borderColor: colors.tint,
                },
              ]}
              onPress={() => setSelectedSymbol(symbol)}
            >
              <Text
                style={[
                  styles.symbolButtonText,
                  {
                    color:
                      selectedSymbol === symbol ? '#FFFFFF' : colors.text,
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
            style={[styles.addButton, { backgroundColor: colors.tint }]}
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

        {/* Chart */}
        {chartData.length > 0 ? (
          <View style={styles.chartContainer}>
            <LineChartProvider data={chartData}>
              <LineChart height={300}>
                <LineChart.Path
                  color={isPositive ? '#4CAF50' : '#F44336'}
                  width={2}
                >
                  <LineChart.Gradient />
                </LineChart.Path>
                <LineChart.CursorCrosshair color={colors.tint}>
                  <LineChart.Tooltip />
                </LineChart.CursorCrosshair>
              </LineChart>
              <View style={styles.chartPriceContainer}>
                <LineChart.PriceText
                  style={[styles.chartPriceText, { color: colors.text }]}
                  format={({ value }) => `$${value.toFixed(2)}`}
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
            Real-time stock prices powered by EODHD WebSocket API
          </Text>
          <Text style={[styles.infoText, { color: colors.text + '80' }]}>
            Get your free API key at: https://eodhistoricaldata.com/
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
