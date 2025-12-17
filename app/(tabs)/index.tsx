import { useColorScheme } from '@/components/useColorScheme';
import { DEFAULT_SYMBOLS, EODHD_API_KEY } from '@/config/api';
import Colors from '@/constants/Colors';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setHistoricalData } from '@/store/slices/stockDataSlice';
import { setSelectedSymbol } from '@/store/slices/uiSlice';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
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

  // Load all symbols in parallel using REST API (much faster than sequential!)
  useEffect(() => {
    if (!EODHD_API_KEY || allSymbols.length === 0) return;

    const loadAllSymbols = async () => {
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
    };

    loadAllSymbols();
  }, [allSymbols.join(','), EODHD_API_KEY, dispatch, historicalChartData]);

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
    const isPositive = item.priceChange.value >= 0;
    const hasData = item.hasData;

    return (
      <TouchableOpacity
        style={[
          styles.stockItem,
          {
            backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff',
            borderBottomColor: colors.text + '10',
          },
        ]}
        onPress={() => handleStockPress(item.symbol)}
        activeOpacity={0.7}
      >
        <View style={styles.stockInfo}>
          <View style={styles.stockHeader}>
            <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
            {hasData ? (
              <View style={styles.priceContainer}>
                <Text style={[styles.price, { color: colors.text }]}>
                  ${item.currentPrice.toFixed(2)}
                </Text>
              </View>
            ) : (
              <ActivityIndicator size="small" color={colors.tint} />
            )}
          </View>

          {hasData && (
            <View style={styles.changeContainer}>
              <Text
                style={[
                  styles.changeText,
                  {
                    color: isPositive ? '#4CAF50' : '#F44336',
                  },
                ]}
              >
                {isPositive ? '+' : ''}
                {item.priceChange.value.toFixed(2)} ({isPositive ? '+' : ''}
                {item.priceChange.percent.toFixed(2)}%)
              </Text>
              {item.volume > 0 && (
                <Text style={[styles.volume, { color: colors.text + '60' }]}>
                  Vol: {item.volume.toLocaleString()}
                </Text>
              )}
            </View>
          )}
        </View>

        <View
          style={[
            styles.indicator,
            {
              backgroundColor: hasData
                ? isPositive
                  ? '#4CAF50'
                  : '#F44336'
                : colors.text + '20',
            },
          ]}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Stocks</Text>
        <Text style={[styles.subtitle, { color: colors.text + '80' }]}>
          {allSymbols.length} {allSymbols.length === 1 ? 'stock' : 'stocks'}
        </Text>
      </View>

      {stockList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text + '80' }]}>
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
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  stockItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  stockInfo: {
    flex: 1,
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  symbol: {
    fontSize: 18,
    fontWeight: '600',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
  },
  changeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  volume: {
    fontSize: 12,
  },
  indicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});
