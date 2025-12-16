/**
 * TradingView Lightweight Charts Component for React Native
 * Uses WebView to render TradingView's professional charting library
 * 
 * Reference: https://github.com/tradingview/charting-library-examples/tree/master/react-native
 */

import { ChartData } from '@/store/slices/stockDataSlice';
import { Timeframe } from '@/store/slices/uiSlice';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface TradingViewChartProps {
  data: ChartData[];
  height?: number;
  timeframe: Timeframe;
  isPositive?: boolean;
}

export default function TradingViewChart({
  data,
  height = 300,
  timeframe,
  isPositive = true,
}: TradingViewChartProps) {
  const colorScheme = useColorScheme();
  const webViewRef = useRef<WebView>(null);
  const isDark = colorScheme === 'dark';

  // Convert ChartData to TradingView format
  const chartDataForTradingView = React.useMemo(() => {
    return data.map((item) => ({
      time: Math.floor(item.timestamp / 1000), // TradingView expects Unix timestamp in seconds
      value: item.value,
      open: item.open || item.value,
      high: item.high || item.value,
      low: item.low || item.value,
      close: item.close || item.value,
    }));
  }, [data]);

  // Generate HTML content (inline for Expo - can be moved to local file if needed)
  const htmlContent = React.useMemo(() => {
    // For better performance, we could load from assets/chart.html
    // But inline works fine for Expo
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
    #chart { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="chart"></div>
  <script>
    let chart, candlestickSeries, lineSeries;
    let isDark = ${isDark};
    let isPositive = ${isPositive};
    
    function initChart() {
      chart = LightweightCharts.createChart(document.getElementById('chart'), {
        width: window.innerWidth,
        height: ${height},
        layout: {
          backgroundColor: isDark ? '#000000' : '#ffffff',
          textColor: isDark ? '#ffffff' : '#000000',
        },
        grid: {
          vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' },
          horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        },
        rightPriceScale: {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      });
      
      candlestickSeries = chart.addCandlestickSeries({
        upColor: isPositive ? '#4CAF50' : '#F44336',
        downColor: isPositive ? '#F44336' : '#4CAF50',
        borderVisible: false,
        wickUpColor: isPositive ? '#4CAF50' : '#F44336',
        wickDownColor: isPositive ? '#F44336' : '#4CAF50',
      });
      
      lineSeries = chart.addLineSeries({
        color: isPositive ? '#4CAF50' : '#F44336',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
    }
    
    window.updateChartData = function(dataJson, dark, positive) {
      try {
        const data = JSON.parse(dataJson);
        if (!chart) {
          isDark = dark;
          isPositive = positive;
          initChart();
        } else if (isDark !== dark || isPositive !== positive) {
          isDark = dark;
          isPositive = positive;
          chart.applyOptions({
            layout: {
              backgroundColor: isDark ? '#000000' : '#ffffff',
              textColor: isDark ? '#ffffff' : '#000000',
            },
          });
          candlestickSeries.applyOptions({
            upColor: isPositive ? '#4CAF50' : '#F44336',
            downColor: isPositive ? '#F44336' : '#4CAF50',
          });
          lineSeries.applyOptions({ color: isPositive ? '#4CAF50' : '#F44336' });
        }
        
        if (data && data.length > 0) {
          const hasOHLC = data.some(d => d.open && d.high && d.low && d.close);
          if (hasOHLC) {
            candlestickSeries.setData(data.map(d => ({
              time: d.time, open: d.open, high: d.high, low: d.low, close: d.close
            })));
            lineSeries.setData([]);
          } else {
            lineSeries.setData(data.map(d => ({ time: d.time, value: d.value })));
            candlestickSeries.setData([]);
          }
        }
      } catch (e) { console.error('Chart update error:', e); }
    };
    
    window.addEventListener('resize', () => {
      if (chart) chart.applyOptions({ width: window.innerWidth });
    });
  </script>
</body>
</html>
    `;
  }, [height, isDark, isPositive]);

  // Update chart when data changes
  useEffect(() => {
    if (webViewRef.current && chartDataForTradingView.length > 0) {
      // Wait for WebView to load before injecting JavaScript
      const timer = setTimeout(() => {
        if (webViewRef.current) {
          const script = `
            (function() {
              if (window.updateChartData) {
                window.updateChartData(
                  ${JSON.stringify(chartDataForTradingView)},
                  ${isDark},
                  ${isPositive}
                );
                true; // Required for injectJavaScript
              } else {
                setTimeout(arguments.callee, 100);
              }
            })();
          `;
          webViewRef.current.injectJavaScript(script);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [chartDataForTradingView, isDark, isPositive, height]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        onLoadEnd={() => {
          // Chart is ready, inject initial data
          if (webViewRef.current && chartDataForTradingView.length > 0) {
            const script = `
              if (window.updateChartData) {
                window.updateChartData(
                  ${JSON.stringify(chartDataForTradingView)},
                  ${isDark},
                  ${isPositive}
                );
              }
              true;
            `;
            webViewRef.current.injectJavaScript(script);
          }
        }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

