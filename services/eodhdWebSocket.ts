/**
 * EODHD WebSocket Service
 * Documentation: https://eodhistoricaldata.com/financial-apis/real-time-data-api-via-websockets/
 */

export interface StockPrice {
  timestamp: number;
  price: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface WebSocketMessage {
  t: string; // timestamp
  p: number; // price
  v?: number; // volume
  o?: number; // open
  h?: number; // high
  l?: number; // low
  c?: number; // close
  s: string; // symbol
}

type MessageCallback = (data: StockPrice) => void;
type ErrorCallback = (error: Error) => void;
type ConnectionCallback = () => void;

class EODHDWebSocket {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private symbols: string[] = [];
  private messageCallbacks: Map<string, MessageCallback[]> = new Map();
  private errorCallback: ErrorCallback | null = null;
  private connectCallback: ConnectionCallback | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private isConnecting = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Connect to EODHD WebSocket
   * @param symbols Array of stock symbols (e.g., ['AAPL', 'MSFT'])
   */
  connect(symbols: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        resolve();
        return;
      }

      this.symbols = symbols;
      this.isConnecting = true;

      // EODHD WebSocket URL
      // Format: wss://ws.eodhistoricaldata.com/ws/us?api_token=YOUR_API_KEY
      const wsUrl = `wss://ws.eodhistoricaldata.com/ws/us?api_token=${this.apiKey}`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('EODHD WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          // Subscribe to symbols
          this.subscribe(symbols);
          
          if (this.connectCallback) {
            this.connectCallback();
          }
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('EODHD WebSocket error:', error);
          this.isConnecting = false;
          
          if (this.errorCallback) {
            this.errorCallback(new Error('WebSocket connection error'));
          }
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('EODHD WebSocket closed');
          this.isConnecting = false;
          this.ws = null;
          
          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => {
              this.connect(this.symbols).catch(console.error);
            }, this.reconnectDelay);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Subscribe to stock symbols
   */
  private subscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // EODHD subscription format: {"action":"subscribe","symbols":"AAPL,MSFT"}
    const subscribeMessage = {
      action: 'subscribe',
      symbols: symbols.join(','),
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log('Subscribed to symbols:', symbols);
  }

  /**
   * Unsubscribe from stock symbols
   */
  unsubscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const unsubscribeMessage = {
      action: 'unsubscribe',
      symbols: symbols.join(','),
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    const symbol = message.s;
    const callbacks = this.messageCallbacks.get(symbol);

    if (callbacks) {
      const stockPrice: StockPrice = {
        timestamp: parseInt(message.t) * 1000, // Convert to milliseconds
        price: message.p,
        volume: message.v,
        open: message.o,
        high: message.h,
        low: message.l,
        close: message.c,
      };

      callbacks.forEach((callback) => callback(stockPrice));
    }
  }

  /**
   * Subscribe to price updates for a symbol
   */
  onPriceUpdate(symbol: string, callback: MessageCallback): () => void {
    if (!this.messageCallbacks.has(symbol)) {
      this.messageCallbacks.set(symbol, []);
    }
    this.messageCallbacks.get(symbol)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.messageCallbacks.get(symbol);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
        if (callbacks.length === 0) {
          this.messageCallbacks.delete(symbol);
        }
      }
    };
  }

  /**
   * Set error callback
   */
  onError(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  /**
   * Set connection callback
   */
  onConnect(callback: ConnectionCallback): void {
    this.connectCallback = callback;
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageCallbacks.clear();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let wsInstance: EODHDWebSocket | null = null;

/**
 * Get or create WebSocket instance
 */
export function getEODHDWebSocket(apiKey: string): EODHDWebSocket {
  if (!wsInstance) {
    wsInstance = new EODHDWebSocket(apiKey);
  }
  return wsInstance;
}

export default EODHDWebSocket;

