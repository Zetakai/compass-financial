import TradingViewChart from '@/components/TradingViewChart';
import { useColorScheme } from '@/components/useColorScheme';
import { DEFAULT_SYMBOLS, FINNHUB_API_KEY } from '@/config/api';
import Colors from '@/constants/Colors';
import { useGetCompanyProfileQuery, useGetCurrentQuoteQuery } from '@/store/api/finnhubApi';
import { useAppDispatch } from '@/store/hooks';
import { updateCurrentPrice } from '@/store/slices/stockDataSlice';
import { setSelectedSymbol } from '@/store/slices/uiSlice';
import { formatMarketCap } from '@/utils/formatUtils';
import { useFocusEffect, useGlobalSearchParams, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

export default function ChartTab() {
  // Use global search params - nested tabs should get params from parent route
  const globalParams = useGlobalSearchParams<{ symbol?: string }>();
  const localParams = useLocalSearchParams<{ symbol?: string }>();
  
  const colorScheme = useColorScheme();
  const dispatch = useAppDispatch();
  const colors = Colors[colorScheme ?? 'light'];

  // Get symbol from global params first (works for nested routes), then local
  const symbol = globalParams.symbol || localParams.symbol;
  // Ensure symbol is a string (expo-router can return arrays)
  const stockSymbol = (Array.isArray(symbol) ? symbol[0] : symbol) || DEFAULT_SYMBOLS[0];

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

  // Fetch current quote using REST API (polling every 30 seconds)
  // This updates Redux state for use in stock list (price changes)
  const { data: currentQuote, refetch: refetchQuote } = useGetCurrentQuoteQuery(stockSymbol, {
    skip: !stockSymbol || !FINNHUB_API_KEY,
    pollingInterval: 30000, // Poll every 30 seconds
    refetchOnMountOrArgChange: true, // Force refetch when symbol changes
  });

  // Fetch company profile for market cap
  const { data: companyProfile, isLoading: isLoadingProfile, refetch: refetchProfile } = useGetCompanyProfileQuery(stockSymbol, {
    skip: !stockSymbol || !FINNHUB_API_KEY,
    refetchOnMountOrArgChange: true, // Force refetch when symbol changes
  });

  // Refetch all data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (stockSymbol && FINNHUB_API_KEY) {
        refetchQuote();
        refetchProfile();
      }
    }, [stockSymbol, refetchQuote, refetchProfile])
  );

  // Update current price in Redux (used by stock list for price changes)
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

  // Format market cap
  const formattedMarketCap = useMemo(() => {
    if (!companyProfile?.marketCap) return 'N/A';
    return formatMarketCap(companyProfile.marketCap);
  }, [companyProfile]);

  // Calculate day range (high - low) as a useful metric
  const dayRange = useMemo(() => {
    if (!currentQuote || !currentQuote.high || !currentQuote.low) return null;
    
    const range = currentQuote.high - currentQuote.low;
    const rangePercent = currentQuote.low > 0 ? (range / currentQuote.low) * 100 : 0;
    
    return {
      high: currentQuote.high,
      low: currentQuote.low,
      range: range,
      rangePercent: rangePercent,
    };
  }, [currentQuote]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Market Info Header */}
      <View
        style={[
          styles.marketInfoHeader,
          {
            backgroundColor: colorScheme === 'dark' ? '#1A1A1A' : '#F5F5F5',
            borderBottomColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          },
        ]}
      >
        {/* Left: Market Cap and Change grouped together */}
        <View style={styles.leftGroup}>
          <View style={styles.marketCapContainer}>
            <Text style={[styles.marketCapLabel, { color: colors.text + '80' }]}>Market Cap</Text>
            {isLoadingProfile ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Text style={[styles.marketCapValue, { color: colors.text }]}>
                {formattedMarketCap}
              </Text>
            )}
          </View>

          {dayRange && (
            <View style={styles.changeContainer}>
              <Text style={[styles.changeLabel, { color: colors.text + '80' }]}>Day Range</Text>
              <Text style={[styles.changeValue, { color: colors.text }]}>
                ${dayRange.low.toFixed(2)} - ${dayRange.high.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Right: Logo and Symbol */}
        <View style={styles.logoContainer}>
          {companyProfile?.logo ? (
            <Image
              source={{ uri: companyProfile.logo }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: colors.tint + '20' }]}>
              <Text style={[styles.logoPlaceholderText, { color: colors.tint }]}>
                {stockSymbol.charAt(0)}
              </Text>
            </View>
          )}
          <Text style={[styles.symbolText, { color: colors.text }]}>{stockSymbol}</Text>
        </View>
      </View>

      {/* TradingView chart - fetches its own historical and real-time data */}
      <View style={styles.chartContainer}>
        <TradingViewChart symbol={stockSymbol} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  marketInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    flex: 1,
  },
  marketCapContainer: {
    gap: 4,
  },
  marketCapLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  marketCapValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  changeContainer: {
    gap: 4,
  },
  changeLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  changeValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 16,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  logoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    fontSize: 14,
    fontWeight: '700',
  },
  symbolText: {
    fontSize: 16,
    fontWeight: '700',
  },
  chartContainer: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
});

