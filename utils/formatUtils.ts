/**
 * Utility functions for formatting data
 */

/**
 * Format market cap to human-readable format
 * @param marketCap Market capitalization in number
 * @returns Formatted string (e.g., "$2.5T", "$500B", "$50M")
 */
export function formatMarketCap(marketCap: number): string {
  if (!marketCap || marketCap === 0) return 'N/A';
  
  // Check for trillions first
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(2)}T`;
  }
  // Check for billions
  if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`;
  }
  // Check for millions
  if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  }
  // For values less than 1 million, show full number
  return `$${marketCap.toLocaleString()}`;
}

