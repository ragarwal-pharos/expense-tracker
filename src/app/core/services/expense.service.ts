import { Injectable } from '@angular/core';
import { Expense } from '../models/expense.model';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private expenses: Expense[] = [];

  constructor(private firebaseService: FirebaseService) {
    this.loadExpenses();
  }

  private async loadExpenses() {
    try {
      console.log('Loading expenses from Firebase...');
      this.expenses = await this.firebaseService.loadExpenses();
      console.log(`Loaded ${this.expenses.length} expenses from Firebase`);
    } catch (error) {
      console.error('Error loading expenses:', error);
      this.expenses = [];
      // Return empty array instead of throwing to prevent app crashes
    }
  }

  async getAll(): Promise<Expense[]> {
    // Optimize: Use cached data if available, only reload if empty
    if (this.expenses.length === 0) {
      await this.loadExpenses();
    }
    return [...this.expenses];
  }

  async add(expense: Omit<Expense, 'id'>): Promise<string> {
    try {
      console.log('Adding expense to Firebase...');
      const id = await this.firebaseService.addExpense(expense);
      console.log(`Expense added with ID: ${id}`);
      // Optimize: No need to reload - Firebase service handles cache update
      return id;
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  }

  async update(expense: Expense): Promise<void> {
    try {
      console.log(`Updating expense with ID: ${expense.id}`);
      
      // Check if this is a local ID (short) vs Firebase ID (long)
      if (expense.id.length < 20) {
        console.warn(`Attempting to update local expense with ID: ${expense.id}. This expense may not exist in Firebase.`);
        // For local IDs, we'll try to update but won't fail if it doesn't exist
        try {
          await this.firebaseService.updateExpense(expense);
        } catch (error) {
          if (error instanceof Error && error.message.includes('does not exist')) {
            console.warn('Local expense not found in Firebase - this is expected for old local data');
            // Remove from local cache
            this.expenses = this.expenses.filter(e => e.id !== expense.id);
            return;
          }
          throw error;
        }
      } else {
        await this.firebaseService.updateExpense(expense);
      }
      
      console.log('Expense updated successfully');
      // Optimize: No need to reload - Firebase service handles cache update
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      console.log(`Deleting expense with ID: ${id}`);
      
      // Check if this is a local ID (short) vs Firebase ID (long)
      if (id.length < 20) {
        console.warn(`Attempting to delete local expense with ID: ${id}. This expense may not exist in Firebase.`);
        // For local IDs, we'll try to delete but won't fail if it doesn't exist
        try {
          await this.firebaseService.deleteExpense(id);
        } catch (error) {
          if (error instanceof Error && error.message.includes('does not exist')) {
            console.warn('Local expense not found in Firebase - this is expected for old local data');
            // Remove from local cache
            this.expenses = this.expenses.filter(e => e.id !== id);
            return;
          }
          throw error;
        }
      } else {
        await this.firebaseService.deleteExpense(id);
      }
      
      console.log('Expense deleted successfully');
      // Optimize: No need to reload from Firebase - Firebase service handles cache update
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  async deleteByCategoryId(categoryId: string): Promise<void> {
    try {
      const expenses = await this.firebaseService.loadExpenses();
      const expensesToDelete = expenses.filter(e => e.categoryId === categoryId);
      
      for (const expense of expensesToDelete) {
        await this.firebaseService.deleteExpense(expense.id);
      }
      await this.loadExpenses(); // Reload from Firebase
    } catch (error) {
      console.error('Error deleting expenses by category:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Expense | undefined> {
    // Optimize: Use cached data if available
    if (this.expenses.length === 0) {
      await this.loadExpenses();
    }
    return this.expenses.find(e => e.id === id);
  }

  // Get expenses by category
  async getByCategoryId(categoryId: string): Promise<Expense[]> {
    return this.firebaseService.getExpensesByCategory(categoryId);
  }

  // Get expenses by date range
  async getByDateRange(startDate: string, endDate: string): Promise<Expense[]> {
    return this.firebaseService.getExpensesByDateRange(startDate, endDate);
  }
} 