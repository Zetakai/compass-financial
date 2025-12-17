/**
 * Finnhub WebSocket Service
 * Documentation: https://finnhub.io/docs/api#websocket-trades
 * Free tier includes WebSocket access!
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

export interface FinnhubTradeMessage {
  type: 'trade';
  data: Array<{
    s: string; // symbol
    p: number; // price
    t: number; // timestamp (milliseconds)
    v: number; // volume
  }>;
}

export interface FinnhubPingMessage {
  type: 'ping';
}

type MessageCallback = (data: StockPrice) => void;
type ErrorCallback = (error: Error) => void;
type ConnectionCallback = () => void;

class FinnhubWebSocket {
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
  private pingInterval: NodeJS.Timeout | null = null;
  private rateLimitedUntil: number | null = null; // Timestamp when rate limit expires
  private readonly RATE_LIMIT_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown after 429

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Connect to Finnhub WebSocket
   * @param symbols Array of stock symbols (e.g., ['AAPL', 'MSFT'])
   */
  connect(symbols: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if we're still in rate limit cooldown
      if (this.rateLimitedUntil && Date.now() < this.rateLimitedUntil) {
        const remainingMinutes = Math.ceil((this.rateLimitedUntil - Date.now()) / 60000);
        const error = new Error(`Rate limited. Please wait ${remainingMinutes} more minute(s) before reconnecting.`);
        console.log(`⏳ Still in rate limit cooldown. Wait ${remainingMinutes} more minute(s).`);
        if (this.errorCallback) {
          this.errorCallback(error);
        }
        reject(error);
        return;
      }

      // Reset rate limit if cooldown expired
      if (this.rateLimitedUntil && Date.now() >= this.rateLimitedUntil) {
        this.rateLimitedUntil = null;
        this.reconnectAttempts = 0; // Reset attempts after cooldown
      }

      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        resolve();
        return;
      }

      this.symbols = symbols;
      this.isConnecting = true;

      // Finnhub WebSocket URL
      // Format: wss://ws.finnhub.io?token=YOUR_API_KEY
      const wsUrl = `wss://ws.finnhub.io?token=${this.apiKey}`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Finnhub WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.rateLimitedUntil = null; // Reset rate limit cooldown on successful connection
          
          // Wait a bit before subscribing to ensure connection is stable
          setTimeout(() => {
            // Subscribe to symbols
            this.subscribe(symbols);
            
            // Start ping interval (Finnhub requires periodic pings)
            this.startPingInterval();
            
            if (this.connectCallback) {
              this.connectCallback();
            }
          }, 100);
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle ping messages
            if (data.type === 'ping') {
              this.handlePing();
              return;
            }
            
            // Handle trade messages
            if (data.type === 'trade' && data.data) {
              this.handleTradeMessage(data as FinnhubTradeMessage);
              return;
            }
            
            // Handle error messages
            if (data.type === 'error') {
              console.error('Finnhub WebSocket error:', data);
              if (this.errorCallback) {
                this.errorCallback(new Error(data.msg || 'Unknown error'));
              }
              return;
            }
            
            console.log('Finnhub WebSocket message:', data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error, event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('Finnhub WebSocket error:', error);
          this.isConnecting = false;
          
          if (this.errorCallback) {
            this.errorCallback(new Error('WebSocket connection error'));
          }
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('Finnhub WebSocket closed', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
          
          this.stopPingInterval();
          this.isConnecting = false;
          this.ws = null;
          
          // Check for rate limiting (429 Too Many Requests)
          const isRateLimited = event.reason && event.reason.includes('429');
          
          // Don't reconnect if it was closed cleanly, due to authentication, or rate limiting
          if (event.code === 1000 || event.code === 1008 || event.code === 1011 || isRateLimited) {
            if (isRateLimited) {
              // Set cooldown period (5 minutes)
              this.rateLimitedUntil = Date.now() + this.RATE_LIMIT_COOLDOWN;
              this.reconnectAttempts = this.maxReconnectAttempts; // Prevent any reconnection attempts
              console.log(`❌ Rate limit exceeded (429). Cooldown active for ${this.RATE_LIMIT_COOLDOWN / 60000} minutes.`);
              if (this.errorCallback) {
                this.errorCallback(new Error(`Rate limit exceeded. Please wait ${this.RATE_LIMIT_COOLDOWN / 60000} minutes before trying again.`));
              }
            } else if (event.code === 1008 || (event.reason && event.reason.includes('403'))) {
              console.log('❌ Connection closed due to authentication failure. Please check your API key.');
              if (this.errorCallback) {
                this.errorCallback(new Error('Authentication failed. Please check your API key.'));
              }
            } else {
              console.log('WebSocket closed cleanly. Not reconnecting.');
              if (this.errorCallback && !event.wasClean) {
                this.errorCallback(new Error(event.reason || 'Connection closed'));
              }
            }
            return;
          }
          
          // Attempt to reconnect with exponential backoff
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            // Exponential backoff: 3s, 6s, 12s, 24s, 48s
            const backoffDelay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${backoffDelay}ms...`);
            setTimeout(() => {
              this.connect(this.symbols).catch(console.error);
            }, backoffDelay);
          } else {
            console.error('Max reconnection attempts reached. Please check your API key and connection.');
            if (this.errorCallback) {
              this.errorCallback(new Error('Max reconnection attempts reached. Please check your API key and connection.'));
            }
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
   * Finnhub format: {"type":"subscribe","symbol":"AAPL"}
   */
  private subscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    symbols.forEach((symbol) => {
      const subscribeMessage = {
        type: 'subscribe',
        symbol: symbol,
      };

      this.ws!.send(JSON.stringify(subscribeMessage));
      console.log('Subscribed to symbol:', symbol);
    });
  }

  /**
   * Unsubscribe from stock symbols
   */
  unsubscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    symbols.forEach((symbol) => {
      const unsubscribeMessage = {
        type: 'unsubscribe',
        symbol: symbol,
      };

      this.ws!.send(JSON.stringify(unsubscribeMessage));
    });
  }

  /**
   * Handle ping messages (Finnhub requires periodic pings)
   */
  private handlePing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    // Ping every 30 seconds
    this.pingInterval = setInterval(() => {
      this.handlePing();
    }, 30000);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Handle trade messages from Finnhub
   */
  private handleTradeMessage(message: FinnhubTradeMessage): void {
    if (!message.data || !Array.isArray(message.data)) {
      return;
    }

    message.data.forEach((trade) => {
      const symbol = trade.s;
      const callbacks = this.messageCallbacks.get(symbol);

      if (callbacks) {
        const stockPrice: StockPrice = {
          timestamp: trade.t, // Already in milliseconds
          price: trade.p,
          volume: trade.v,
        };

        callbacks.forEach((callback) => callback(stockPrice));
      }
    });
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
    this.stopPingInterval();
    if (this.ws) {
      // Unsubscribe from all symbols before closing
      if (this.symbols.length > 0) {
        this.unsubscribe(this.symbols);
      }
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
let wsInstance: FinnhubWebSocket | null = null;

/**
 * Get or create WebSocket instance
 */
export function getFinnhubWebSocket(apiKey: string): FinnhubWebSocket {
  if (!wsInstance) {
    wsInstance = new FinnhubWebSocket(apiKey);
  }
  return wsInstance;
}

export default FinnhubWebSocket;

