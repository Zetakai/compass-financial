/**
 * TradingView Advanced Chart Widget Component for React Native
 * Uses TradingView's official Advanced Chart widget via WebView
 * Includes built-in timeframe controls in the top toolbar
 * 
 * Reference: https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
 */

import { ChartData } from '@/store/slices/stockDataSlice';
import { Timeframe } from '@/store/slices/uiSlice';
import React, { useMemo } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface TradingViewChartProps {
  data: ChartData[]; // Historical data (not used with widget, but kept for compatibility)
  realtimeTick?: { timestamp: number; price: number; volume?: number }; // Not used with widget
  height?: number;
  timeframe: Timeframe;
  isPositive?: boolean;
  symbol?: string; // Stock symbol (e.g., 'AAPL')
  symbolName?: string; // Display name (e.g., 'Apple')
}

// Map our timeframe to TradingView interval
function getTradingViewInterval(timeframe: Timeframe): string {
  switch (timeframe) {
    case '1D':
      return 'D'; // Daily
    case '1W':
      return 'W'; // Weekly
    case '1M':
      return 'M'; // Monthly
    case '1Y':
      return '12M'; // 12 months
    default:
      return 'D';
  }
}

// Format symbol for TradingView (e.g., 'AAPL' -> 'NASDAQ:AAPL')
function formatSymbolForTradingView(symbol: string): string {
  // For US stocks, assume NASDAQ or NYSE
  // You can enhance this to detect the exchange
  return `NASDAQ:${symbol}`;
}

export default function TradingViewChart({
  data,
  realtimeTick,
  height = 300,
  timeframe,
  isPositive = true,
  symbol = 'AAPL',
  symbolName,
}: TradingViewChartProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Generate HTML with TradingView Advanced Chart widget
  const htmlContent = useMemo(() => {
    const tradingViewSymbol = formatSymbolForTradingView(symbol);
    const interval = getTradingViewInterval(timeframe);
    const displayName = symbolName || symbol;
    const backgroundColor = isDark ? '#0F0F0F' : '#FFFFFF';
    const gridColor = isDark ? 'rgba(242, 242, 242, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    const theme = isDark ? 'dark' : 'light';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${backgroundColor};
    }
    .tradingview-widget-container {
      height: 100%;
      width: 100%;
      position: relative;
    }
    .tradingview-widget-container__widget {
      height: calc(100% - 32px);
      width: 100%;
    }
    .tradingview-widget-copyright {
      display: none;
    }
  </style>
</head>
<body>
  <div class="tradingview-widget-container" style="height:100%;width:100%">
    <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>
    <div class="tradingview-widget-copyright">
      <a href="https://www.tradingview.com/symbols/${tradingViewSymbol}/" rel="noopener nofollow" target="_blank">
        <span class="blue-text">${displayName} stock chart</span>
      </a>
      <span class="trademark"> by TradingView</span>
    </div>
    <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
    {
      "allow_symbol_change": false,
      "calendar": false,
      "details": false,
      "hide_side_toolbar": true,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "hide_volume": false,
      "hotlist": false,
      "interval": "${interval}",
      "locale": "en",
      "save_image": true,
      "style": "1",
      "symbol": "${tradingViewSymbol}",
      "theme": "${theme}",
      "timezone": "Etc/UTC",
      "backgroundColor": "${backgroundColor}",
      "gridColor": "${gridColor}",
      "watchlist": [],
      "withdateranges": false,
      "compareSymbols": [],
      "studies": [],
      "autosize": true
    }
    </script>
  </div>
</body>
</html>
    `;
  }, [symbol, symbolName, timeframe, isDark, height]);

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={false}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
});
