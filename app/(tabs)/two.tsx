import { useColorScheme } from '@/components/useColorScheme';
import { DEFAULT_SYMBOLS } from '@/config/api';
import Colors from '@/constants/Colors';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSelectedSymbol } from '@/store/slices/uiSlice';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
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
      }

      return {
        symbol,
        currentPrice: currentPrice?.price || 0,
        priceChange,
        volume: currentPrice?.volume || 0,
        hasData: !!currentPrice,
      };
    });
  }, [allSymbols, currentPrices, historicalChartData]);

  const handleStockPress = (symbol: string) => {
    dispatch(setSelectedSymbol(symbol));
    // Navigate to the stock detail screen
    router.push(`/stock/${symbol}`);
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
        <Text style={[styles.title, { color: colors.text }]}>Stock List</Text>
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
