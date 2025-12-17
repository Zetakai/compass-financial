/**
 * TradingView Lightweight Charts Component for React Native
 * Uses lightweight-charts-react-components for better React integration
 * 
 * Reference: https://github.com/ukorvl/lightweight-charts-react-components
 */

import { ChartData } from '@/store/slices/stockDataSlice';
import { Timeframe } from '@/store/slices/uiSlice';
import { ColorType, CrosshairMode } from 'lightweight-charts';
import { CandlestickSeries, Chart, TimeScale, TimeScaleFitContentTrigger } from 'lightweight-charts-react-components';
import React, { useMemo } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

interface TradingViewChartProps {
  data: ChartData[]; // Historical data (loaded once via REST API)
  realtimeTick?: { timestamp: number; price: number; volume?: number }; // Real-time price tick
  height?: number;
  timeframe: Timeframe;
  isPositive?: boolean;
}

export default function TradingViewChart({
  data,
  realtimeTick,
  height = 300,
  timeframe,
  isPositive = true,
}: TradingViewChartProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Convert ChartData to TradingView format
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item) => ({
      time: Math.floor(item.timestamp / 1000) as any, // TradingView expects Unix timestamp in seconds
      open: item.open || item.value || 0,
      high: item.high || item.value || 0,
      low: item.low || item.value || 0,
      close: item.close || item.value || 0,
    })).filter(d => d.close > 0);
  }, [data]);

  // Chart options
  const chartOptions = useMemo(() => ({
    layout: {
      background: { type: ColorType.Solid, color: isDark ? '#131722' : '#ffffff' },
      textColor: isDark ? '#d1d4dc' : '#191919',
    },
    grid: {
      vertLines: {
        color: isDark ? '#2B2B43' : '#e0e3e9',
        visible: true,
      },
      horzLines: {
        color: isDark ? '#2B2B43' : '#e0e3e9',
        visible: true,
      },
    },
    timeScale: {
      visible: true,
      timeVisible: true,
      borderVisible: true,
      borderColor: isDark ? '#2B2B43' : '#e0e3e9',
      ticksVisible: true,
    },
    rightPriceScale: {
      borderVisible: true,
      borderColor: isDark ? '#2B2B43' : '#e0e3e9',
    },
    crosshair: {
      mode: CrosshairMode.Normal,
    },
  }), [isDark]);

  // Candlestick series options
  const candlestickOptions = useMemo(() => ({
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderUpColor: '#26a69a',
    borderDownColor: '#ef5350',
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
    priceFormat: {
      type: 'price' as const,
      precision: 2,
      minMove: 0.01,
    },
  }), []);

  if (chartData.length === 0) {
    return (
      <View style={[styles.container, { height, backgroundColor: isDark ? '#131722' : '#ffffff' }]}>
        {/* Empty state */}
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <Chart options={chartOptions} containerProps={{ style: { flex: 1, height: '100%' } }}>
        <CandlestickSeries data={chartData} options={candlestickOptions} />
        <TimeScale>
          <TimeScaleFitContentTrigger deps={[chartData]} />
        </TimeScale>
      </Chart>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
});
