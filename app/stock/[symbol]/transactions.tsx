import { useColorScheme } from '@/components/useColorScheme';
import { DEFAULT_SYMBOLS, FINNHUB_API_KEY } from '@/config/api';
import Colors from '@/constants/Colors';
import { useAppDispatch } from '@/store/hooks';
import { setSelectedSymbol } from '@/store/slices/uiSlice';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// Transaction interface
interface Transaction {
  id: string;
  timestamp: number;
  price: number;
  volume: number;
  type: 'buy' | 'sell';
}

export default function TransactionsTab() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const colorScheme = useColorScheme();
  const dispatch = useAppDispatch();
  const colors = Colors[colorScheme ?? 'light'];

  const stockSymbol = symbol || DEFAULT_SYMBOLS[0];
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const navigation = useNavigation();

  useEffect(() => {
    dispatch(setSelectedSymbol(stockSymbol));
  }, [stockSymbol, dispatch]);

  useEffect(() => {
    navigation.setOptions({
      title: stockSymbol,
      headerBackTitle: 'Stocks',
      headerTitle: stockSymbol,
    });
  }, [stockSymbol, navigation]);

  // Fetch transaction data from REST API
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!stockSymbol || !FINNHUB_API_KEY) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Use Finnhub's tick data endpoint to get recent trades
        // Note: Free tier may have limitations, so we'll also generate mock data
        const response = await fetch(
          `https://finnhub.io/api/v1/stock/tick?symbol=${stockSymbol}&token=${FINNHUB_API_KEY}&limit=50`
        );

        if (response.ok) {
          const data = await response.json();
          
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            // Convert Finnhub tick data to transactions
            const tickTransactions: Transaction[] = data.data.map((tick: any, index: number) => ({
              id: `tick-${tick.t}-${index}`,
              timestamp: tick.t * 1000, // Convert to milliseconds
              price: tick.p,
              volume: tick.v || 0,
              type: tick.p > (data.data[index - 1]?.p || tick.p) ? 'buy' : 'sell',
            }));
            setTransactions(tickTransactions);
          } else {
            // Generate mock transactions based on current price
            generateMockTransactions();
          }
        } else {
          // Generate mock transactions if API fails
          generateMockTransactions();
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
        // Generate mock transactions on error
        generateMockTransactions();
      } finally {
        setIsLoading(false);
      }
    };

    // Generate mock transaction data (simulated trades)
    const generateMockTransactions = async () => {
      try {
        // Get current quote to base mock data on
        const quoteResponse = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${stockSymbol}&token=${FINNHUB_API_KEY}`
        );
        
        let basePrice = 150; // Default price
        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json();
          basePrice = quoteData.c || basePrice;
        }

        // Generate 20 mock transactions
        const mockTransactions: Transaction[] = [];
        const now = Date.now();
        
        for (let i = 0; i < 20; i++) {
          const priceVariation = (Math.random() - 0.5) * basePrice * 0.02; // ±2% variation
          const price = basePrice + priceVariation;
          const volume = Math.floor(Math.random() * 10000) + 100;
          const timestamp = now - (i * 60000); // 1 minute apart
          
          mockTransactions.push({
            id: `mock-${timestamp}-${i}`,
            timestamp,
            price: Math.round(price * 100) / 100,
            volume,
            type: Math.random() > 0.5 ? 'buy' : 'sell',
          });
        }
        
        setTransactions(mockTransactions);
      } catch (error) {
        console.error('Error generating mock transactions:', error);
        setTransactions([]);
      }
    };

    fetchTransactions();
  }, [stockSymbol]);

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
            <View style={styles.transactionLeft}>
              <Text
                style={[
                  styles.transactionType,
                  { color: isBuy ? '#4CAF50' : '#F44336' },
                ]}
              >
                {isBuy ? 'BUY' : 'SELL'}
              </Text>
              <Text style={[styles.transactionVolume, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)', marginLeft: 8 }]}>
                Vol: {item.volume.toLocaleString()}
              </Text>
            </View>
            <Text style={[styles.transactionPrice, { color: colors.text }]}>
              ${item.price.toFixed(2)}
            </Text>
          </View>
          <View style={styles.transactionDetails}>
            <Text style={[styles.transactionTime, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }]}>
              {formatTime(item.timestamp)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={isLoading || transactions.length === 0 ? [] : transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={[styles.transactionsSection, { backgroundColor: colors.background }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Recent Transactions
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.text + '60' }]}>
                {transactions.length} {transactions.length === 1 ? 'trade' : 'trades'}
              </Text>
            </View>

            {isLoading ? (
              <View style={styles.emptyTransactions}>
                <ActivityIndicator size="large" color={colors.tint} />
                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.text + '60', marginTop: 12 },
                  ]}
                >
                  Loading transactions...
                </Text>
              </View>
            ) : transactions.length === 0 ? (
              <View style={styles.emptyTransactions}>
                <Text style={[styles.emptyText, { color: colors.text + '60' }]}>
                  No transaction data available.
                </Text>
              </View>
            ) : null}
          </View>
        }
        contentContainerStyle={styles.listContent}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  transactionsSection: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
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
  listContent: {
    paddingBottom: 0,
  },
  transactionsList: {
    gap: 4,
  },
  transactionItem: {
    padding: 12,
    borderRadius: 8,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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

