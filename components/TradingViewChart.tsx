/**
 * TradingView Lightweight Charts Component for React Native
 * Uses WebView to render TradingView's professional charting library
 * 
 * Reference: https://github.com/tradingview/charting-library-examples/tree/master/react-native
 */

import { ChartData } from '@/store/slices/stockDataSlice';
import { Timeframe } from '@/store/slices/uiSlice';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface TradingViewChartProps {
  data: ChartData[]; // Pre-filtered data based on timeframe (filtering happens in React Native)
  height?: number;
  timeframe: Timeframe; // Used for time scale formatting, not for data filtering
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert ChartData to TradingView format
  const chartDataForTradingView = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map((item) => ({
      time: Math.floor(item.timestamp / 1000), // TradingView expects Unix timestamp in seconds
      value: item.value,
      open: item.open || item.value,
      high: item.high || item.value,
      low: item.low || item.value,
      close: item.close || item.value,
    }));
  }, [data]);

  // Generate HTML content with proper error handling
  const htmlContent = React.useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
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
      background: ${isDark ? '#000000' : '#ffffff'};
      position: relative;
    }
    #chart { 
      width: 100%; 
      height: 100%;
      min-height: ${height}px;
      position: absolute;
      top: 0;
      left: 0;
    }
    #error {
      display: none;
      color: red;
      padding: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="error"></div>
  <div id="chart"></div>
  <script>
    (function() {
      let chart = null;
      let candlestickSeries = null;
      let lineSeries = null;
      let isDark = ${isDark};
      let isPositive = ${isPositive};
      let chartInitialized = false;
      let pendingData = null;
      
      function showError(msg) {
        const errorEl = document.getElementById('error');
        if (errorEl) {
          errorEl.textContent = msg;
          errorEl.style.display = 'block';
        }
        console.error('Chart error:', msg);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: msg }));
        }
      }
      
      function initChart() {
        if (chartInitialized) {
          return;
        }
        
        // Check if library is loaded
        if (typeof LightweightCharts === 'undefined') {
          showError('TradingView library not loaded');
          return;
        }
        
        const chartElement = document.getElementById('chart');
        if (!chartElement) {
          showError('Chart container not found');
          return;
        }
        
        try {
          const containerWidth = chartElement.clientWidth || window.innerWidth || 400;
          const containerHeight = chartElement.clientHeight || ${height} || 300;
          
          chart = LightweightCharts.createChart(chartElement, {
            width: containerWidth,
            height: containerHeight,
            autoSize: true,
            layout: {
              backgroundColor: isDark ? '#000000' : '#ffffff',
              textColor: isDark ? '#ffffff' : '#000000',
            },
            grid: {
              vertLines: { 
                color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                visible: true,
              },
              horzLines: { 
                color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                visible: true,
              },
            },
            timeScale: {
              timeVisible: true,
              secondsVisible: false,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
            },
            rightPriceScale: {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
            },
            crosshair: { 
              mode: LightweightCharts.CrosshairMode.Normal 
            },
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
          
          chartInitialized = true;
          console.log('Chart initialized successfully');
          
          // Send ready message
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'chartReady' }));
          }
          
          // Apply pending data if any
          if (pendingData) {
            updateChartData(pendingData.data, pendingData.dark, pendingData.positive);
            pendingData = null;
          }
        } catch (e) {
          showError('Failed to initialize chart: ' + e.message);
        }
      }
      
      function updateChartData(dataJson, dark, positive) {
        try {
          if (!chartInitialized) {
            // Store for later
            pendingData = { data: dataJson, dark, positive };
            return;
          }
          
          if (!chart || !candlestickSeries || !lineSeries) {
            console.error('Chart not ready');
            return;
          }
          
          const data = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson;
          
          if (!data || !Array.isArray(data) || data.length === 0) {
            console.warn('No data to display');
            return;
          }
          
          // Update theme if changed
          if (isDark !== dark || isPositive !== positive) {
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
            lineSeries.applyOptions({ 
              color: isPositive ? '#4CAF50' : '#F44336' 
            });
          }
          
          // Check if we have OHLC data
          const hasOHLC = data.some(d => d.open && d.high && d.low && d.close && 
            d.open !== d.value && d.high !== d.value && d.low !== d.value && d.close !== d.value);
          
          if (hasOHLC) {
            const ohlcData = data.map(d => ({
              time: d.time,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
            }));
            candlestickSeries.setData(ohlcData);
            lineSeries.setData([]);
          } else {
            const lineData = data.map(d => ({ 
              time: d.time, 
              value: d.value || d.close || d.open || 0 
            }));
            lineSeries.setData(lineData);
            candlestickSeries.setData([]);
          }
          
          console.log('Chart data updated:', data.length, 'points');
        } catch (e) {
          showError('Failed to update chart: ' + e.message);
        }
      }
      
      // Expose update function
      window.updateChartData = updateChartData;
      
      // Wait for library to load
      function waitForLibrary() {
        if (typeof LightweightCharts !== 'undefined') {
          console.log('Library loaded, initializing chart...');
          setTimeout(initChart, 100);
        } else {
          setTimeout(waitForLibrary, 100);
        }
      }
      
      // Start initialization
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForLibrary);
      } else {
        waitForLibrary();
      }
      
      // Handle resize
      window.addEventListener('resize', () => {
        if (chart) {
          chart.applyOptions({ width: window.innerWidth });
        }
      });
    })();
  </script>
</body>
</html>
    `;
  }, [height, isDark, isPositive]);

  // Update chart when data changes
  useEffect(() => {
    if (!webViewRef.current || chartDataForTradingView.length === 0) {
      return;
    }

    const script = `
      (function() {
        if (window.updateChartData) {
          window.updateChartData(
            ${JSON.stringify(chartDataForTradingView)},
            ${isDark},
            ${isPositive}
          );
        }
      })();
      true;
    `;

    // Wait a bit for WebView to be ready
    const timer = setTimeout(() => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(script);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [chartDataForTradingView, isDark, isPositive]);

  return (
    <View style={[styles.container, { height }]}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={isDark ? '#ffffff' : '#000000'} />
        </View>
      )}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        onLoadEnd={() => {
          setIsLoading(false);
          // Inject initial data after a delay
          setTimeout(() => {
            if (webViewRef.current && chartDataForTradingView.length > 0) {
              const script = `
                (function() {
                  if (window.updateChartData) {
                    window.updateChartData(
                      ${JSON.stringify(chartDataForTradingView)},
                      ${isDark},
                      ${isPositive}
                    );
                  }
                })();
                true;
              `;
              webViewRef.current.injectJavaScript(script);
            }
          }, 1500);
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          setError('WebView error: ' + nativeEvent.description);
          setIsLoading(false);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView HTTP error:', nativeEvent);
          setError('Failed to load chart library');
          setIsLoading(false);
        }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'chartReady') {
              setIsLoading(false);
              setError(null);
            } else if (message.type === 'error') {
              setError(message.message);
              setIsLoading(false);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }}
        style={[styles.webview, { height }]}
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
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  webview: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    zIndex: 1,
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 2,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
  },
});
