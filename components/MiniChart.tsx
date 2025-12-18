/**
 * Simple SVG-based Mini Chart Component
 * Displays a 24h price trend line chart
 */

import { useColorScheme } from '@/components/useColorScheme';
import { ChartData } from '@/store/slices/stockDataSlice';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface MiniChartProps {
  symbol: string;
  data?: ChartData[]; // Historical data (24h)
}

export default function MiniChart({ symbol, data }: MiniChartProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Process data for chart
  const chartPath = useMemo(() => {
    if (!data || data.length === 0) {
      return { path: '', isPositive: true, areaPath: '' };
    }

    const width = 120;
    const height = 60;
    const padding = 4;

    // Get price values
    const values = data.map((d) => d.value).filter((v) => v != null && v > 0);
    
    if (values.length === 0) {
      return { path: '', isPositive: true, areaPath: '' };
    }
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1; // Avoid division by zero

    // Calculate if trend is positive (last price > first price)
    const isPositive = values[values.length - 1] >= values[0];

    // Generate path points
    const points: { x: number; y: number }[] = values.map((value, index) => {
      const x = padding + (index / (values.length - 1 || 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return { x, y };
    });

    // Create path string for line
    const pathString = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    // Create area path (line + bottom fill)
    const areaPath = `${pathString} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return { path: pathString, isPositive, areaPath };
  }, [data]);

  const lineColor = chartPath.isPositive
    ? isDark
      ? '#4CAF50'
      : '#4CAF50'
    : isDark
    ? '#F44336'
    : '#F44336';

  const areaColor = chartPath.isPositive
    ? isDark
      ? 'rgba(76, 175, 80, 0.2)'
      : 'rgba(76, 175, 80, 0.15)'
    : isDark
    ? 'rgba(244, 67, 54, 0.2)'
    : 'rgba(244, 67, 54, 0.15)';

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5' }]}>
        <Svg width={120} height={60} viewBox="0 0 120 60">
          <Path
            d="M 4 30 L 116 30"
            stroke={isDark ? '#333' : '#CCC'}
            strokeWidth={1}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5' }]}>
      <Svg width={120} height={60} viewBox="0 0 120 60">
        {/* Area fill */}
        <Path d={chartPath.areaPath} fill={areaColor} />
        {/* Line */}
        <Path
          d={chartPath.path}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
