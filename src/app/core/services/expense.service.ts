import { Injectable } from '@angular/core';
import { Expense } from '../models/expense.model';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class ExpenseService {

  constructor(private firebaseService: FirebaseService) {}

  async getAll(): Promise<Expense[]> {
    // Simply call Firebase service directly - no caching
    return await this.firebaseService.loadExpenses();
  }

  async add(expense: Omit<Expense, 'id'>): Promise<string> {
    try {
      console.log('Adding expense to Firebase...');
      const id = await this.firebaseService.addExpense(expense);
      console.log(`Expense added with ID: ${id}`);
      return id;
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  }

  async update(expense: Expense): Promise<void> {
    try {
      console.log(`Updating expense with ID: ${expense.id}`);
      await this.firebaseService.updateExpense(expense);
      console.log('Expense updated successfully');
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      console.log(`Deleting expense with ID: ${id}`);
      await this.firebaseService.deleteExpense(id);
      console.log('Expense deleted successfully');
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
    } catch (error) {
      console.error('Error deleting expenses by category:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Expense | undefined> {
    const expenses = await this.firebaseService.loadExpenses();
    return expenses.find(e => e.id === id);
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