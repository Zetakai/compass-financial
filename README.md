# Compass Financial - Real-Time Stock Prices App

A modern React Native mobile application built with Expo Router that displays real-time stock prices using EODHD WebSocket API and beautiful interactive charts powered by react-native-wagmi-charts.

## 🚀 Features

- **Real-time Stock Prices** - Live price updates via WebSocket connection
- **Interactive Charts** - Beautiful line charts with cursor and tooltips
- **Multiple Symbols** - Track multiple stocks simultaneously
- **Custom Symbols** - Add any stock symbol to your watchlist
- **Price Indicators** - Visual indicators for price changes (green/red)
- **Connection Status** - Real-time connection monitoring
- **Cross-Platform** - Works on iOS, Android, and Web

## 📋 Prerequisites

- Node.js (v18 or higher)
- Yarn package manager
- Expo CLI (`npm install -g expo-cli`)
- EODHD API key ([Get one for free](https://eodhistoricaldata.com/))

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd compass-financial
```

2. Install dependencies:
```bash
yarn install
```

3. Configure your API key:
   - Option 1: Create a `.env` file:
     ```
     EXPO_PUBLIC_EODHD_API_KEY=your_api_key_here
     ```
   - Option 2: Edit `config/api.ts` and replace the API key value

## 🏃 Running the App

### Development Mode

```bash
# Start the Expo development server
yarn start

# Run on iOS
yarn ios

# Run on Android
yarn android

# Run on Web
yarn web
```

### Development Client (Custom Native Code)

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

```bash
# Build for Android (requires EAS CLI)
yarn build:android:production

# Build for iOS (requires EAS CLI)
yarn build:ios:production

# Build for both platforms
yarn build:all:production
```

**Note:** For production builds, you need to install EAS CLI:
```bash
npm install -g eas-cli
eas login
```

## 📱 Default Stock Symbols

The app tracks these symbols by default:
- **AAPL** - Apple Inc.
- **MSFT** - Microsoft Corporation
- **GOOGL** - Alphabet Inc.
- **AMZN** - Amazon.com Inc.
- **TSLA** - Tesla Inc.

## 🎯 Usage

1. **View Stock Prices**: Select a symbol from the tab bar to view its real-time price and chart
2. **Add Custom Symbols**: Enter a stock symbol in the input field and press "Add"
3. **Monitor Connection**: Check the connection status indicator (green = connected, red = disconnected)
4. **View Price Changes**: See price changes with color-coded indicators (green for positive, red for negative)

## 🏗️ Project Structure

```
compass-financial/
├── app/                    # Expo Router app directory
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Main stock prices screen
│   │   └── _layout.tsx    # Tab layout configuration
│   └── _layout.tsx        # Root layout
├── components/            # Reusable React components
├── config/                # Configuration files
│   └── api.ts            # API key configuration
├── constants/            # App constants
├── services/             # Business logic services
│   └── eodhdWebSocket.ts # WebSocket service for EODHD
└── assets/              # Images, fonts, etc.
```

## 🔧 Technologies Used

- **Expo** - React Native framework
- **Expo Router** - File-based routing
- **React Native Wagmi Charts** - Beautiful charting library
- **EODHD API** - Real-time financial data
- **TypeScript** - Type-safe development
- **React Native Reanimated** - Smooth animations
- **React Native Gesture Handler** - Touch interactions

## 📚 API Documentation

- [EODHD WebSocket API](https://eodhistoricaldata.com/financial-apis/real-time-data-api-via-websockets/)
- [React Native Wagmi Charts](https://github.com/coinjar/react-native-wagmi-charts)
- [Expo Documentation](https://docs.expo.dev/)

## 🐛 Troubleshooting

### WebSocket Connection Issues
- Verify your API key is correct in `config/api.ts`
- Check your internet connection
- Ensure your EODHD API key is valid and not expired
- Free tier may have rate limits

### Chart Not Displaying
- Wait a few seconds for data to arrive
- Ensure WebSocket is connected (green indicator)
- Check that the symbol is valid

### Build Issues
- Make sure you have the latest Expo CLI
- Run `yarn prebuild:clean:all` before building
- Check that all dependencies are installed

## 📄 License

This project is private and proprietary.

## 👥 Contributing

This is a private project. For issues or questions, please contact the repository maintainers.

## 🙏 Acknowledgments

- [EODHD](https://eodhistoricaldata.com/) for providing financial data APIs
- [Coinjar](https://github.com/coinjar) for the wagmi charts library
- [Expo](https://expo.dev/) for the amazing development platform

