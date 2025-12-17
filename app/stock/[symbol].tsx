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
    setTimeframe,
    Timeframe,
} from '@/store/slices/uiSlice';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Transaction interface (from REST API - using latest price as transaction)
interface Transaction {
  id: string;
  timestamp: number;
  price: number;
  volume: number;
  type: 'buy' | 'sell';
}

export default function StockDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const dispatch = useAppDispatch();
  const colors = Colors[colorScheme ?? 'light'];

  // Use the symbol from URL params, fallback to Redux selected symbol
  const stockSymbol = symbol || DEFAULT_SYMBOLS[0];
  const [timeframe, setTimeframeState] = useState<Timeframe>('1D');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'chart' | 'transactions'>('chart');

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
      title: stockSymbol, // Show just the symbol (e.g., "AAPL")
      headerBackTitle: 'Stocks',
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
      skip: !EODHD_API_KEY, // Load regardless of WebSocket connection
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
            volume: 0, // Quote doesn't include volume
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
  const currentPrice = currentPrices[stockSymbol]?.price || historicalData[historicalData.length - 1]?.value || 0;

  const timeframes: Timeframe[] = ['1D', '1W', '1M', '1Y'];
  
  // Get screen dimensions for fullscreen chart
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  // Fullscreen chart: screen height - bottom tabs (~80px) - timeframe selector (~60px) - safe area
  // Need extra space at bottom for x-axis labels
  const chartHeight = screenHeight - 160; // Fullscreen chart (like DexScreener) with space for x-axis

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isBuy = item.type === 'buy';
    return (
      <View
        style={[
          styles.transactionItem,
          {
            backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff',
            borderBottomColor: colors.text + '10',
          },
        ]}
      >
        <View style={styles.transactionInfo}>
          <View style={styles.transactionHeader}>
            <Text
              style={[
                styles.transactionType,
                { color: isBuy ? '#4CAF50' : '#F44336' },
              ]}
            >
              {isBuy ? 'BUY' : 'SELL'}
            </Text>
            <Text style={[styles.transactionPrice, { color: colors.text }]}>
              ${item.price.toFixed(2)}
            </Text>
          </View>
          <View style={styles.transactionDetails}>
            <Text style={[styles.transactionVolume, { color: colors.text + '80' }]}>
              Vol: {item.volume.toLocaleString()}
            </Text>
            <Text style={[styles.transactionTime, { color: colors.text + '60' }]}>
              {formatTime(item.timestamp)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Tab Content - Fullscreen */}
      {activeTab === 'chart' ? (
        <View style={styles.tabContent}>
          {/* Timeframe Selector - Floating at top */}
          <View style={[
            styles.timeframeContainer,
            {
              backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
            }
          ]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timeframeScroll}
            >
              {timeframes.map((tf) => (
                <TouchableOpacity
                  key={tf}
                  style={[
                    styles.timeframeButton,
                    {
                      backgroundColor:
                        timeframe === tf
                          ? colorScheme === 'dark'
                            ? '#2f95dc'
                            : '#1976d2'
                          : colorScheme === 'dark'
                            ? 'rgba(42, 42, 42, 0.8)'
                            : 'rgba(240, 240, 240, 0.8)',
                      borderWidth: timeframe === tf ? 0 : 1,
                      borderColor: colorScheme === 'dark' ? '#444' : '#ddd',
                    },
                  ]}
                  onPress={() => {
                    setTimeframeState(tf);
                    dispatch(setTimeframe(tf));
                  }}
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

          {/* Chart - Fullscreen */}
          {isLoadingEODHD ? (
            <View style={[styles.noDataContainer, { height: chartHeight }]}>
              <ActivityIndicator size="large" color={colors.tint} />
              <Text style={[styles.noDataText, { color: colors.text + '80', marginTop: 12 }]}>
                Loading {timeframe} data...
              </Text>
            </View>
          ) : eodhdError ? (
            <View style={[styles.noDataContainer, { height: chartHeight }]}>
              <Text style={[styles.noDataText, { color: '#F44336' }]}>
                Error loading chart data
              </Text>
            </View>
          ) : historicalData.length > 0 ? (
            <View style={[styles.chartContainer, { height: chartHeight }]}>
              <TradingViewChart
                data={historicalData}
                realtimeTick={latestRealtimeTick}
                height={chartHeight}
                timeframe={timeframe}
                isPositive={isPositive}
              />
            </View>
          ) : (
            <View style={[styles.noDataContainer, { height: chartHeight }]}>
              <Text style={[styles.noDataText, { color: colors.text + '80' }]}>
                Waiting for chart data...
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.tabContent}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Transactions Section */}
            <View style={styles.transactionsSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Recent Transactions
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.text + '60' }]}>
                  {transactions.length} {transactions.length === 1 ? 'trade' : 'trades'}
                </Text>
              </View>

              {transactions.length === 0 ? (
                <View style={styles.emptyTransactions}>
                  <Text style={[styles.emptyText, { color: colors.text + '60' }]}>
                    No transaction data available. Using REST API for price updates.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={transactions}
                  renderItem={renderTransaction}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  contentContainerStyle={styles.transactionsList}
                  initialNumToRender={20}
                  maxToRenderPerBatch={10}
                />
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Bottom Tab Bar */}
      <SafeAreaView edges={['bottom']} style={[styles.bottomTabContainer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            styles.bottomTabButton,
            {
              borderTopWidth: activeTab === 'chart' ? 2 : 0,
              borderTopColor: colorScheme === 'dark' ? '#2f95dc' : '#1976d2',
            },
          ]}
          onPress={() => setActiveTab('chart')}
        >
          <Text
            style={[
              styles.bottomTabButtonText,
              {
                color: activeTab === 'chart'
                  ? (colorScheme === 'dark' ? '#2f95dc' : '#1976d2')
                  : colorScheme === 'dark'
                    ? '#888'
                    : '#666',
                fontWeight: activeTab === 'chart' ? '600' : '400',
              },
            ]}
          >
            Chart
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.bottomTabButton,
            {
              borderTopWidth: activeTab === 'transactions' ? 2 : 0,
              borderTopColor: colorScheme === 'dark' ? '#2f95dc' : '#1976d2',
            },
          ]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text
            style={[
              styles.bottomTabButtonText,
              {
                color: activeTab === 'transactions'
                  ? (colorScheme === 'dark' ? '#2f95dc' : '#1976d2')
                  : colorScheme === 'dark'
                    ? '#888'
                    : '#666',
                fontWeight: activeTab === 'transactions' ? '600' : '400',
              },
            ]}
          >
            Transactions
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerInfo: {
    flex: 1,
  },
  symbol: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  price: {
    fontSize: 20,
    fontWeight: '600',
  },
  change: {
    fontSize: 16,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'transparent',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  tabContent: {
    flex: 1,
  },
  bottomTabContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 8,
    paddingBottom: 8,
  },
  bottomTabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Account for bottom tabs
  },
  timeframeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingVertical: 12,
    paddingTop: 8,
  },
  timeframeScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeframeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartContainer: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    paddingBottom: 40, // Extra space for x-axis labels
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    textAlign: 'center',
  },
  transactionsSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  transactionsList: {
    gap: 8,
  },
  transactionItem: {
    padding: 16,
    borderRadius: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  transactionPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionVolume: {
    fontSize: 12,
  },
  transactionTime: {
    fontSize: 12,
  },
  emptyTransactions: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

