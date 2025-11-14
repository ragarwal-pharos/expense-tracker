import { Injectable } from '@angular/core';
import { Expense } from '../models/expense.model';

export interface ActionHistoryItem {
  id: string;
  type: 'delete' | 'update' | 'create';
  expense: Expense;
  timestamp: Date;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class ActionHistoryService {
  private history: ActionHistoryItem[] = [];
  private maxHistorySize = 50; // Keep last 50 actions

  addAction(type: 'delete' | 'update' | 'create', expense: Expense, description?: string): string {
    const actionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const action: ActionHistoryItem = {
      id: actionId,
      type,
      expense: { ...expense }, // Deep copy
      timestamp: new Date(),
      description: description || this.getDefaultDescription(type, expense)
    };

    this.history.unshift(action); // Add to beginning
    
    // Keep only last maxHistorySize items
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }

    return actionId;
  }

  getLastAction(): ActionHistoryItem | null {
    return this.history.length > 0 ? this.history[0] : null;
  }

  getHistory(limit?: number): ActionHistoryItem[] {
    if (limit) {
      return this.history.slice(0, limit);
    }
    return [...this.history];
  }

  removeAction(actionId: string): boolean {
    const index = this.history.findIndex(a => a.id === actionId);
    if (index !== -1) {
      this.history.splice(index, 1);
      return true;
    }
    return false;
  }

  clearHistory(): void {
    this.history = [];
  }

  private getDefaultDescription(type: string, expense: Expense): string {
    switch (type) {
      case 'delete':
        return `Deleted "${expense.description}" (₹${expense.amount})`;
      case 'update':
        return `Updated "${expense.description}"`;
      case 'create':
        return `Created "${expense.description}" (₹${expense.amount})`;
      default:
        return 'Action performed';
    }
  }
}

