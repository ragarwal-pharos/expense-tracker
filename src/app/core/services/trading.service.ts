import { Injectable } from '@angular/core';
import { Trade } from '../models/trade.model';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class TradingService {

  constructor(private firebaseService: FirebaseService) {}

  async getAll(): Promise<Trade[]> {
    return await this.firebaseService.loadTrades();
  }

  async add(trade: Omit<Trade, 'id'>): Promise<string> {
    try {
      console.log('Adding trade to Firebase...');
      const id = await this.firebaseService.addTrade(trade);
      console.log(`Trade added with ID: ${id}`);
      return id;
    } catch (error) {
      console.error('Error adding trade:', error);
      throw error;
    }
  }

  async update(trade: Trade): Promise<void> {
    try {
      console.log(`Updating trade with ID: ${trade.id}`);
      await this.firebaseService.updateTrade(trade);
      console.log('Trade updated successfully');
    } catch (error) {
      console.error('Error updating trade:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      console.log(`Deleting trade with ID: ${id}`);
      await this.firebaseService.deleteTrade(id);
      console.log('Trade deleted successfully');
    } catch (error) {
      console.error('Error deleting trade:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Trade | undefined> {
    const trades = await this.firebaseService.loadTrades();
    return trades.find(t => t.id === id);
  }

  async getByDateRange(startDate: string, endDate: string): Promise<Trade[]> {
    return this.firebaseService.getTradesByDateRange(startDate, endDate);
  }

  // Calculate profit/loss for a closed trade (legacy method - deprecated)
  // This method is no longer used with the new model that uses isProfit boolean
  calculateProfitLoss(buyTrade: Trade, sellTrade: Trade): { profitLoss: number; profitLossPercentage: number } {
    // Legacy method - new model doesn't use totalAmount or fees
    // Return zero values as this method is deprecated
    return { profitLoss: 0, profitLossPercentage: 0 };
  }

  // Get all open positions (legacy method - no longer used with new model)
  getOpenPositions(trades: Trade[]): Trade[] {
    // New model doesn't use status field, return empty array
    return [];
  }

  // Get total profit/loss (legacy method - no longer used with new model)
  getTotalProfitLoss(trades: Trade[]): number {
    // New model uses isProfit boolean instead of calculated profit/loss
    // Return count difference instead
    const profitCount = trades.filter(t => t.isProfit === true).length;
    const lossCount = trades.filter(t => t.isProfit === false).length;
    return profitCount - lossCount;
  }

  // Get profit/loss by symbol (updated for new model)
  getProfitLossBySymbol(trades: Trade[]): { [symbol: string]: { profit: number; loss: number } } {
    const result: { [symbol: string]: { profit: number; loss: number } } = {};
    
    trades.forEach(trade => {
      if (!result[trade.symbol]) {
        result[trade.symbol] = { profit: 0, loss: 0 };
      }
      if (trade.isProfit === true) {
        result[trade.symbol].profit++;
      } else if (trade.isProfit === false) {
        result[trade.symbol].loss++;
      }
    });
    
    return result;
  }
}
