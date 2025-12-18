import MiniChart from '@/components/MiniChart';
import { useColorScheme } from '@/components/useColorScheme';
import { DEFAULT_SYMBOLS, EODHD_API_KEY, FINNHUB_API_KEY } from '@/config/api';
import Colors from '@/constants/Colors';
import { useGetCompanyProfileQuery, useGetCurrentQuoteQuery } from '@/store/api/finnhubApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setHistoricalData } from '@/store/slices/stockDataSlice';
import { setSelectedSymbol } from '@/store/slices/uiSlice';
import { formatMarketCap } from '@/utils/formatUtils';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function StockListScreen() {
  const colorScheme = useColorScheme();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const colors = Colors[colorScheme ?? 'light'];

  // Redux state
  const customSymbols = useAppSelector((state) => state.ui.customSymbols);
  const currentPrices = useAppSelector((state) => state.stockData.currentPrices);
  const historicalChartData = useAppSelector(
    (state) => state.stockData.historicalChartData
  );

  const allSymbols = [...DEFAULT_SYMBOLS, ...customSymbols];

  // Stock Item Component (needs to be outside to use hooks properly)
  const StockItem = ({ item }: { item: typeof stockList[0] }) => {
    const itemColorScheme = useColorScheme();
    const itemColors = Colors[itemColorScheme ?? 'light'];
    const isPositive = item.priceChange.value >= 0;
    const hasData = item.hasData;
    
    // Get historical data for mini chart
    // Use daily data (already loaded) - shows last 7-10 days trend
    const chartData = useMemo(() => {
      const dailyData = historicalChartData[item.symbol]?.['1D'] || [];
      if (dailyData.length > 0) {
        // Get last 7-10 days for mini chart to show recent trend
        return dailyData.slice(-10);
      }
      return [];
    }, [historicalChartData, item.symbol]);
    
    // Fetch company profile and quote for this stock
    const { data: companyProfile } = useGetCompanyProfileQuery(item.symbol, {
      skip: !item.symbol || !FINNHUB_API_KEY,
    });
    
    const { data: quote } = useGetCurrentQuoteQuery(item.symbol, {
      skip: !item.symbol || !FINNHUB_API_KEY,
    });

    const marketCap = companyProfile?.marketCap ? formatMarketCap(companyProfile.marketCap) : 'N/A';
    const change24h = quote ? quote.percentChange : null;

    return (
      <TouchableOpacity
        style={[
          styles.stockItem,
          {
            backgroundColor: itemColorScheme === 'dark' ? '#1E1E1E' : '#FFFFFF',
            shadowColor: itemColorScheme === 'dark' ? '#000' : '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: itemColorScheme === 'dark' ? 0.3 : 0.1,
            shadowRadius: 4,
            elevation: 3,
          },
        ]}
        onPress={() => handleStockPress(item.symbol)}
        activeOpacity={0.8}
      >
        <View style={styles.stockInfo}>
          <View style={styles.stockHeader}>
            <View style={styles.symbolContainer}>
              <View
                style={[
                  styles.symbolBadge,
                  {
                    backgroundColor: itemColorScheme === 'dark' 
                      ? (isPositive ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)')
                      : (isPositive ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)'),
                  },
                ]}
              >
                <Text style={[styles.symbol, { color: itemColors.text }]}>{item.symbol}</Text>
              </View>
            </View>
            {hasData ? (
              <View style={styles.priceContainer}>
                <Text style={[styles.price, { color: itemColors.text }]}>
                  ${item.currentPrice.toFixed(2)}
                </Text>
              </View>
            ) : (
              <ActivityIndicator size="small" color={itemColors.tint} />
            )}
          </View>

          {hasData && (
            <View style={styles.metadataContainer}>
              <View style={styles.metadataRow}>
                <View style={styles.metadataItem}>
                  <Text style={[styles.metadataLabel, { color: itemColors.text + '80' }]}>Market Cap</Text>
                  <Text style={[styles.metadataValue, { color: itemColors.text }]}>{marketCap}</Text>
                </View>
                {change24h !== null && (
                  <View style={styles.metadataItem}>
                    <Text style={[styles.metadataLabel, { color: itemColors.text + '80' }]}>24h</Text>
                    <Text
                      style={[
                        styles.metadataValue,
                        {
                          color: change24h >= 0 ? '#4CAF50' : '#F44336',
                        },
                      ]}
                    >
                      {change24h >= 0 ? '+' : ''}
                      {change24h.toFixed(2)}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
        <View style={styles.miniChartWrapper}>
          <MiniChart symbol={item.symbol} data={chartData} />
        </View>
      </TouchableOpacity>
    );
  };

  // Load all symbols in parallel using REST API (much faster than sequential!)
  const loadAllSymbols = useCallback(async () => {
    if (!EODHD_API_KEY || allSymbols.length === 0) return;

    // Filter out symbols that already have data
    const symbolsToLoad = allSymbols.filter(
      (symbol) => !historicalChartData[symbol]?.['1D']?.length
    );

    if (symbolsToLoad.length === 0) return;

    // Load all symbols in parallel
    const promises = symbolsToLoad.map(async (symbol) => {
      try {
        const response = await fetch(
          `https://eodhd.com/api/eod/${symbol}.US?api_token=${EODHD_API_KEY}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&period=d&fmt=json`
        );

        if (!response.ok) {
          console.warn(`Failed to load ${symbol}: ${response.status}`);
          return null;
        }

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          // EODHD returns data in reverse chronological order (newest first), so we need to reverse it
          const chartData = data
            .map((item: any) => ({
              timestamp: new Date(item.date).getTime(),
              value: item.close || item.adjusted_close,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close || item.adjusted_close,
              volume: item.volume || 0,
            }))
            .reverse(); // Reverse to get chronological order (oldest first)

          return { symbol, data: chartData };
        }
        return null;
      } catch (error) {
        console.error(`Error loading ${symbol}:`, error);
        return null;
      }
    });

    // Wait for all requests to complete
    const results = await Promise.all(promises);

    // Dispatch all results at once
    results.forEach((result) => {
      if (result) {
        dispatch(
          setHistoricalData({
            symbol: result.symbol,
            timeframe: '1D',
            data: result.data,
          })
        );
      }
    });
  }, [allSymbols.join(','), EODHD_API_KEY, dispatch, historicalChartData]);

  // // Load data on mount
  // useEffect(() => {
  //   loadAllSymbols();
  // }, [loadAllSymbols]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadAllSymbols();
    }, [loadAllSymbols])
  );

  // Calculate price changes for each symbol
  const stockList = useMemo(() => {
    return allSymbols.map((symbol) => {
      const currentPrice = currentPrices[symbol];
      const historical = historicalChartData[symbol]?.['1D'] || [];
      
      let priceChange = { value: 0, percent: 0 };
      
      if (currentPrice && historical.length > 0) {
        const previousPrice = historical[0]?.value || currentPrice.price;
        const change = currentPrice.price - previousPrice;
        const percent = previousPrice !== 0 ? (change / previousPrice) * 100 : 0;
        priceChange = { value: change, percent };
      } else if (historical.length > 0) {
        // Use historical data if no current price
        const current = historical[historical.length - 1]?.value || 0;
        const previous = historical[0]?.value || current;
        const change = current - previous;
        const percent = previous !== 0 ? (change / previous) * 100 : 0;
        priceChange = { value: change, percent };
      }

      return {
        symbol,
        currentPrice: currentPrice?.price || historical[historical.length - 1]?.value || 0,
        priceChange,
        volume: currentPrice?.volume || 0,
        hasData: !!currentPrice || historical.length > 0,
      };
    });
  }, [allSymbols, currentPrices, historicalChartData]);

  const handleStockPress = (symbol: string) => {
    dispatch(setSelectedSymbol(symbol));
    // Navigate to the stock detail screen with chart tab
    router.push(`/stock/${symbol}/chart`);
  };

  const renderStockItem = ({ item }: { item: typeof stockList[0] }) => {
    return <StockItem item={item} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Stocks</Text>
          <Text style={[styles.subtitle, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }]}>
            {allSymbols.length} {allSymbols.length === 1 ? 'stock' : 'stocks'} tracked
          </Text>
        </View>
      </View>

      {stockList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }]}>
            No stocks added yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={stockList}
          renderItem={renderStockItem}
          keyExtractor={(item) => item.symbol}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  stockItem: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  stockInfo: {
    flex: 1,
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  symbolContainer: {
    flex: 1,
  },
  symbolBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  symbol: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metadataContainer: {
    marginTop: 8,
  },
  metadataRow: {
    flexDirection: 'row',
    gap: 20,
  },
  metadataItem: {
    gap: 4,
  },
  metadataLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  miniChartWrapper: {
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
