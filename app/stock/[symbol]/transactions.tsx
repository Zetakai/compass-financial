import { useColorScheme } from '@/components/useColorScheme';
import { DEFAULT_SYMBOLS, FINNHUB_API_KEY } from '@/config/api';
import Colors from '@/constants/Colors';
import { useGetCompanyProfileQuery, useGetCurrentQuoteQuery, useGetHistoricalDataQuery } from '@/store/api/finnhubApi';
import { useAppDispatch } from '@/store/hooks';
import { setSelectedSymbol } from '@/store/slices/uiSlice';
import { formatMarketCap } from '@/utils/formatUtils';
import { useFocusEffect, useGlobalSearchParams, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

export default function OverviewTab() {
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

  // Fetch company profile and quote
  // Force refetch when symbol changes by using refetchOnMountOrArgChange
  const { data: companyProfile, isLoading: isLoadingProfile, refetch: refetchProfile } = useGetCompanyProfileQuery(stockSymbol, {
    skip: !stockSymbol || !FINNHUB_API_KEY,
    refetchOnMountOrArgChange: true, // Force refetch when symbol changes
  });

  const { data: currentQuote, refetch: refetchQuote } = useGetCurrentQuoteQuery(stockSymbol, {
    skip: !stockSymbol || !FINNHUB_API_KEY,
    refetchOnMountOrArgChange: true, // Force refetch when symbol changes
  });

  // Fetch 1 year of historical data for 52W high/low and ROI calculation
  const { data: historicalData1Y, refetch: refetchHistorical } = useGetHistoricalDataQuery(
    { symbol: stockSymbol, timeframe: '1Y' },
    { 
      skip: !stockSymbol || !FINNHUB_API_KEY,
      refetchOnMountOrArgChange: true, // Force refetch when symbol changes
    }
  );

  // Refetch all data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (stockSymbol && FINNHUB_API_KEY) {
        refetchProfile();
        refetchQuote();
        refetchHistorical();
      }
    }, [stockSymbol, refetchProfile, refetchQuote, refetchHistorical])
  );

  // Also refetch when symbol changes (in case focus effect doesn't catch it)
  useEffect(() => {
    if (stockSymbol && FINNHUB_API_KEY) {
      refetchProfile();
      refetchQuote();
      refetchHistorical();
    }
    dispatch(setSelectedSymbol(stockSymbol));
  }, [stockSymbol, refetchProfile, refetchQuote, refetchHistorical, dispatch]);

  useEffect(() => {
    navigation.setOptions({
      title: stockSymbol,
      headerBackTitle: 'Stocks',
      headerTitle: stockSymbol,
    });
  }, [stockSymbol, navigation]);

  // Calculate 52W high/low and ROI
  const performanceMetrics = useMemo(() => {
    if (!historicalData1Y || historicalData1Y.length === 0 || !currentQuote) {
      return null;
    }

    const highs = historicalData1Y.map((d) => d.high || d.value);
    const lows = historicalData1Y.map((d) => d.low || d.value);
    const week52High = Math.max(...highs);
    const week52Low = Math.min(...lows);
    const currentPrice = currentQuote.price;

    // Calculate ROI from 1 year ago (first data point)
    const price1YearAgo = historicalData1Y[0]?.value || currentPrice;
    const roi = price1YearAgo > 0 ? ((currentPrice - price1YearAgo) / price1YearAgo) * 100 : 0;

    // Calculate % from 52W high
    const percentFrom52WHigh = week52High > 0 ? ((currentPrice - week52High) / week52High) * 100 : 0;

    return {
      week52High,
      week52Low,
      roi,
      percentFrom52WHigh,
    };
  }, [historicalData1Y, currentQuote]);

  const borderColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const cardBackground = colorScheme === 'dark' ? '#1A1A1A' : '#F5F5F5';

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Key Stats */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Key Stats</Text>
        <View style={[styles.card, { backgroundColor: cardBackground }]}>
          {isLoadingProfile ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.tint} />
            </View>
          ) : (
            <>
              {companyProfile && companyProfile.marketCap > 0 && (
                <View style={[styles.statRow, { borderBottomColor: borderColor }]}>
                  <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Market Cap</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatMarketCap(companyProfile.marketCap)}
                  </Text>
                </View>
              )}
              
              {companyProfile?.industry && (
                <View style={[styles.statRow, { borderBottomColor: borderColor }]}>
                  <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Industry</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {companyProfile.industry}
                  </Text>
                </View>
              )}
              
              {companyProfile?.exchange && (
                <View style={[styles.statRow, { borderBottomColor: borderColor }]}>
                  <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Exchange</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {companyProfile.exchange}
                  </Text>
                </View>
              )}
              
              {companyProfile?.currency && (
                <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Currency</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {companyProfile.currency}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {/* Performance */}
      {performanceMetrics && currentQuote && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Performance</Text>
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <View style={[styles.statRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.statLabel, { color: colors.text + '80' }]}>1Y ROI</Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: performanceMetrics.roi >= 0 ? '#4CAF50' : '#F44336',
                  },
                ]}
              >
                {performanceMetrics.roi >= 0 ? '+' : ''}
                {performanceMetrics.roi.toFixed(2)}%
              </Text>
            </View>
            
            <View style={[styles.statRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.statLabel, { color: colors.text + '80' }]}>% from 52W High</Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: performanceMetrics.percentFrom52WHigh >= 0 ? '#F44336' : '#4CAF50',
                  },
                ]}
              >
                {performanceMetrics.percentFrom52WHigh.toFixed(2)}%
              </Text>
            </View>
            
            <View style={[styles.statRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.statLabel, { color: colors.text + '80' }]}>52W High</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                ${performanceMetrics.week52High.toFixed(2)}
              </Text>
            </View>
            
            <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.statLabel, { color: colors.text + '80' }]}>52W Low</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                ${performanceMetrics.week52Low.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Trading Information */}
      {currentQuote && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Trading Information</Text>
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <View style={[styles.statRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Current Price</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                ${currentQuote.price.toFixed(2)}
              </Text>
            </View>
            
            <View style={[styles.statRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Change</Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: currentQuote.percentChange >= 0 ? '#4CAF50' : '#F44336',
                  },
                ]}
              >
                {currentQuote.change >= 0 ? '+' : ''}
                {currentQuote.change.toFixed(2)} ({currentQuote.percentChange >= 0 ? '+' : ''}
                {currentQuote.percentChange.toFixed(2)}%)
              </Text>
            </View>
            
            {currentQuote.open > 0 && (
              <View style={[styles.statRow, { borderBottomColor: borderColor }]}>
                <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Open</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  ${currentQuote.open.toFixed(2)}
                </Text>
              </View>
            )}
            
            {currentQuote.high > 0 && (
              <View style={[styles.statRow, { borderBottomColor: borderColor }]}>
                <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Day High</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  ${currentQuote.high.toFixed(2)}
                </Text>
              </View>
            )}
            
            {currentQuote.low > 0 && (
              <View style={[styles.statRow, { borderBottomColor: borderColor }]}>
                <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Day Low</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  ${currentQuote.low.toFixed(2)}
                </Text>
              </View>
            )}
            
            {currentQuote.previousClose > 0 && (
              <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Previous Close</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  ${currentQuote.previousClose.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Loading State */}
      {isLoadingProfile && !companyProfile && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.text + '80' }]}>
            Loading company overview...
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 0,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  statLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
});
