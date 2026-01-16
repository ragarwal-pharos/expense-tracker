export interface Trade {
  id: string;
  symbol: string; // Index (nifty50, banknifty, finnifty, sensex)
  indexValue: number; // Index value at the time of trade
  tradeType: 'call' | 'put'; // Call or Put option
  isProfit: boolean; // true for profit, false for loss
  amount: number; // Profit or loss amount
  date: string; // ISO string (YYYY-MM-DD)
  notes?: string; // Additional notes
  createdAt?: string; // ISO timestamp for creation time
  userId?: string; // Added for Firebase user isolation
  // Legacy fields (optional for backward compatibility)
  stockName?: string; // Full stock name (deprecated)
  quantity?: number; // Number of shares (deprecated)
  price?: number; // Price per share (deprecated)
  totalAmount?: number; // quantity * price (deprecated)
  status?: 'open' | 'closed'; // Open position or closed trade (deprecated)
  profitLoss?: number; // Calculated profit/loss for closed trades (deprecated)
  profitLossPercentage?: number; // Percentage gain/loss (deprecated)
  fees?: number; // Trading fees/commission (deprecated)
  linkedTradeId?: string; // ID of the paired trade (deprecated)
}
