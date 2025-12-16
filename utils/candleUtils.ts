/**
 * Candle Utilities for OHLC (Open-High-Low-Close) Data
 * 
 * In financial apps, WebSocket sends price "ticks" (individual trades),
 * but charts display "candles" (OHLC bars). This utility handles:
 * 1. Updating the last candle with new price ticks
 * 2. Creating new candles when the timeframe period changes
 * 3. Merging historical candles with real-time updates
 */

import { ChartData } from '@/store/slices/stockDataSlice';
import { Timeframe } from '@/store/slices/uiSlice';

/**
 * Get the candle period in milliseconds for a timeframe
 */
export function getCandlePeriodMs(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1H':
      return 60 * 60 * 1000; // 1 hour
    case '1D':
      return 24 * 60 * 60 * 1000; // 1 day
    case '1W':
      return 7 * 24 * 60 * 60 * 1000; // 1 week
    case '1M':
      return 30 * 24 * 60 * 60 * 1000; // ~1 month (30 days)
    case '1Y':
      return 365 * 24 * 60 * 60 * 1000; // ~1 year (365 days)
    default:
      return 24 * 60 * 60 * 1000; // Default to 1 day
  }
}

/**
 * Get the start timestamp of a candle for a given timestamp and timeframe
 * This aligns timestamps to candle boundaries (e.g., 10:00:00, 11:00:00 for 1H)
 */
export function getCandleStartTimestamp(timestamp: number, timeframe: Timeframe): number {
  const periodMs = getCandlePeriodMs(timeframe);
  return Math.floor(timestamp / periodMs) * periodMs;
}

/**
 * Update or create a candle from a price tick
 * 
 * Logic:
 * - If the tick belongs to the current (last) candle, update its OHLC
 * - If the tick belongs to a new candle period, create a new candle
 * - Discard ticks that are older than the last historical candle (already in REST data)
 */
export function updateCandleWithTick(
  candles: ChartData[],
  tick: { timestamp: number; price: number; volume?: number },
  timeframe: Timeframe,
  lastHistoricalTimestamp?: number
): ChartData[] {
  // Discard ticks older than historical data (already in REST snapshot)
  if (lastHistoricalTimestamp && tick.timestamp <= lastHistoricalTimestamp) {
    return candles;
  }

  const candleStart = getCandleStartTimestamp(tick.timestamp, timeframe);
  const newCandles = [...candles];

  // Check if we have a last candle and if the tick belongs to it
  if (newCandles.length > 0) {
    const lastCandle = newCandles[newCandles.length - 1];
    const lastCandleStart = getCandleStartTimestamp(lastCandle.timestamp, timeframe);

    // Same candle period - update the last candle
    if (candleStart === lastCandleStart) {
      const updatedCandle: ChartData = {
        ...lastCandle,
        timestamp: candleStart, // Ensure aligned timestamp
        value: tick.price, // Close price
        close: tick.price,
        high: Math.max(lastCandle.high || lastCandle.value, tick.price),
        low: Math.min(lastCandle.low || lastCandle.value, tick.price),
        volume: (lastCandle.volume || 0) + (tick.volume || 0),
      };
      newCandles[newCandles.length - 1] = updatedCandle;
      return newCandles;
    }
  }

  // New candle period - create a new candle
  const newCandle: ChartData = {
    timestamp: candleStart,
    value: tick.price, // Close price
    open: tick.price, // First tick in candle = open
    high: tick.price,
    low: tick.price,
    close: tick.price,
    volume: tick.volume || 0,
  };

  newCandles.push(newCandle);
  
  // Keep only last 1000 candles for performance
  if (newCandles.length > 1000) {
    return newCandles.slice(-1000);
  }

  return newCandles;
}

/**
 * Merge historical candles with real-time candle updates
 * 
 * This is Step C: The Merge
 * - Historical data from REST API (the snapshot)
 * - Real-time candles from WebSocket (the live pulse)
 * - No gaps, no duplicates
 */
export function mergeHistoricalAndRealtime(
  historical: ChartData[],
  realtime: ChartData[],
  timeframe: Timeframe
): ChartData[] {
  if (historical.length === 0) {
    return realtime;
  }

  if (realtime.length === 0) {
    return historical;
  }

  // Find the last historical candle timestamp
  const lastHistoricalTime = historical[historical.length - 1].timestamp;
  const lastHistoricalCandleStart = getCandleStartTimestamp(lastHistoricalTime, timeframe);

  // Filter real-time candles to only include new ones (after last historical)
  const newRealtimeCandles = realtime.filter((candle) => {
    const candleStart = getCandleStartTimestamp(candle.timestamp, timeframe);
    return candleStart > lastHistoricalCandleStart;
  });

  // If the last historical candle and first real-time candle are in the same period,
  // merge them (update historical with real-time OHLC)
  if (newRealtimeCandles.length > 0) {
    const firstRealtimeCandle = newRealtimeCandles[0];
    const firstRealtimeCandleStart = getCandleStartTimestamp(
      firstRealtimeCandle.timestamp,
      timeframe
    );

    if (firstRealtimeCandleStart === lastHistoricalCandleStart) {
      // Same candle - merge OHLC values
      const lastHistorical = historical[historical.length - 1];
      const mergedCandle: ChartData = {
        ...lastHistorical,
        high: Math.max(lastHistorical.high || lastHistorical.value, firstRealtimeCandle.high || firstRealtimeCandle.value),
        low: Math.min(lastHistorical.low || lastHistorical.value, firstRealtimeCandle.low || firstRealtimeCandle.value),
        close: firstRealtimeCandle.close || firstRealtimeCandle.value,
        value: firstRealtimeCandle.value,
        volume: (lastHistorical.volume || 0) + (firstRealtimeCandle.volume || 0),
      };

      return [
        ...historical.slice(0, -1),
        mergedCandle,
        ...newRealtimeCandles.slice(1),
      ];
    }
  }

  // No overlap - just append
  return [...historical, ...newRealtimeCandles];
}

