# Compass Financial

A professional React Native mobile application built with Expo Router for real-time stock market data visualization and analysis. The application provides comprehensive stock tracking with interactive charts, transaction history, and multi-symbol monitoring capabilities.

## Overview

Compass Financial is a cross-platform financial application that enables users to track stock prices, view historical data through interactive charts, and monitor recent transactions. Built with modern React Native technologies and powered by industry-standard financial data APIs, the application delivers a professional trading experience on mobile devices.

## Features

- **Real-time Stock Prices**: Live price updates with polling-based data synchronization
- **Interactive Charts**: Professional candlestick charts powered by TradingView Advanced Chart widget
- **Historical Data Analysis**: View stock performance across multiple timeframes (1D, 1W, 1M, 1Y)
- **Transaction History**: Detailed view of recent trades and market activity
- **Multi-Symbol Tracking**: Monitor multiple stocks simultaneously from a unified interface
- **Dark Mode Support**: Automatic theme adaptation based on system preferences
- **Cross-Platform**: Native support for iOS, Android, and Web platforms

## Architecture

The application follows a modern React Native architecture with the following key components:

- **State Management**: Redux Toolkit with RTK Query for efficient API data fetching and caching
- **Navigation**: Expo Router with file-based routing for type-safe navigation
- **Data Providers**: Integration with Finnhub and EODHD APIs for comprehensive market data
- **Charting**: TradingView Advanced Chart widget for professional-grade financial visualization
- **Type Safety**: Full TypeScript implementation for robust development

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or higher)
- Yarn package manager
- Expo CLI (install globally: `npm install -g expo-cli`)
- API keys from one or both providers:
  - Finnhub API key ([Get one for free](https://finnhub.io/))
  - EODHD API key ([Get one for free](https://eodhistoricaldata.com/))

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd compass-financial
```

2. Install dependencies:
```bash
yarn install
```

3. Configure your API keys:

   Create a `.env` file in the root directory:
   ```
   EXPO_PUBLIC_FINNHUB_API_KEY=your_finnhub_api_key_here
   EXPO_PUBLIC_EODHD_API_KEY=your_eodhd_api_key_here
   ```

   Alternatively, edit `config/api.ts` and replace the API key values directly.

## Running the Application

### Development Mode

Start the Expo development server:
```bash
yarn start
```

Run on specific platforms:
```bash
# iOS Simulator
yarn ios

# Android Emulator or Device
yarn android

# Web Browser
yarn web
```

### Development Client (Custom Native Code)

For development builds with custom native code:

```bash
# Clean prebuild and run on Android device
yarn android:device

# Clean prebuild and run on iOS device
yarn ios:device

# Clean prebuild for Android only
yarn prebuild:clean:android

# Clean prebuild for iOS only
yarn prebuild:clean:ios

# Clean prebuild for both platforms
yarn prebuild:clean:all
```

### Production Builds

Build production-ready applications using Expo Application Services (EAS):

```bash
# Build for Android (requires EAS CLI)
yarn build:android:production

# Build for iOS (requires EAS CLI)
yarn build:ios:production

# Build for both platforms
yarn build:all:production
```

**Note:** For production builds, you need to install and configure EAS CLI:
```bash
npm install -g eas-cli
eas login
```

## Default Stock Symbols

The application tracks the following symbols by default:

- **AAPL** - Apple Inc.
- **MSFT** - Microsoft Corporation
- **GOOGL** - Alphabet Inc.
- **AMZN** - Amazon.com Inc.
- **TSLA** - Tesla Inc.

## Usage

### Stock List View

The main screen displays a list of default stock symbols with their current prices and price change indicators. Tap on any stock symbol to navigate to its detailed view.

### Stock Detail View

The detail view provides two main sections accessible via bottom tab navigation:

1. **Chart Tab**: Fullscreen interactive candlestick chart with TradingView's professional charting tools
   - View historical price data across multiple timeframes
   - Analyze price movements with built-in chart indicators
   - Automatic theme adaptation (dark/light mode)

2. **Transactions Tab**: Recent transaction history for the selected stock
   - View recent trades with buy/sell indicators
   - See transaction volume and timestamps
   - Monitor market activity in real-time

## Project Structure

```
compass-financial/
├── app/                          # Expo Router app directory
│   ├── (tabs)/                   # Tab navigation screens
│   │   ├── index.tsx             # Main stock list screen
│   │   └── _layout.tsx           # Tab layout configuration
│   ├── stock/                    # Stock detail screens
│   │   └── [symbol]/             # Dynamic route for stock symbols
│   │       ├── _layout.tsx       # Detail screen tab layout
│   │       ├── chart.tsx         # Chart tab screen
│   │       └── transactions.tsx  # Transactions tab screen
│   └── _layout.tsx               # Root layout configuration
├── components/                   # Reusable React components
│   └── TradingViewChart.tsx     # TradingView chart component
├── config/                       # Configuration files
│   └── api.ts                    # API key configuration
├── constants/                    # App constants and theme
├── store/                        # Redux store configuration
│   ├── api/                      # RTK Query API slices
│   │   ├── finnhubApi.ts         # Finnhub API endpoints
│   │   └── eodhdApi.ts           # EODHD API endpoints
│   ├── slices/                   # Redux slices
│   │   ├── stockDataSlice.ts     # Stock data state management
│   │   └── uiSlice.ts            # UI state management
│   ├── hooks.ts                  # Typed Redux hooks
│   └── store.ts                   # Store configuration
└── assets/                       # Images, fonts, and static assets
```

## Technologies

- **Expo**: React Native framework for cross-platform development
- **Expo Router**: File-based routing system with type-safe navigation
- **React Native**: Mobile application framework
- **Redux Toolkit**: State management with RTK Query for API integration
- **TradingView Charts**: Professional financial charting library
- **TypeScript**: Type-safe JavaScript development
- **React Native Reanimated**: High-performance animations
- **React Native Gesture Handler**: Advanced touch gesture handling
- **React Native Safe Area Context**: Safe area insets management
- **React Native WebView**: Web content rendering for chart widgets

## API Integration

The application integrates with two financial data providers:

### Finnhub API
- **Primary Use**: Current quotes and real-time price updates
- **Endpoints**: Quote data, tick data for transactions
- **Rate Limits**: 60 calls/minute on free tier
- **Documentation**: [Finnhub API Docs](https://finnhub.io/docs/api)

### EODHD API
- **Primary Use**: Historical OHLCV (Open-High-Low-Close-Volume) data
- **Endpoints**: Historical data for various timeframes
- **Rate Limits**: Varies by subscription tier
- **Documentation**: [EODHD API Docs](https://eodhistoricaldata.com/financial-apis/)

## Troubleshooting

### API Connection Issues

- Verify your API keys are correctly configured in `.env` or `config/api.ts`
- Check your internet connection
- Ensure your API keys are valid and not expired
- Free tier APIs may have rate limits; consider upgrading if you exceed limits

### Chart Not Displaying

- Wait a few seconds for data to load from the API
- Verify the stock symbol is valid and supported by the data provider
- Check browser console or device logs for error messages
- Ensure TradingView widget scripts are loading correctly

### Build Issues

- Ensure you have the latest Expo CLI installed
- Run `yarn prebuild:clean:all` before building to clear cached native code
- Verify all dependencies are installed with `yarn install`
- Check that your development environment meets the prerequisites

## License

This project is private and proprietary. All rights reserved.

## Contributing

This is a private project. For issues, questions, or feature requests, please contact the repository maintainers.

## Acknowledgments

- [TradingView](https://www.tradingview.com/) for providing the Advanced Chart widget
- [Finnhub](https://finnhub.io/) for financial market data APIs
- [EODHD](https://eodhistoricaldata.com/) for historical market data
- [Expo](https://expo.dev/) for the development platform and tooling
