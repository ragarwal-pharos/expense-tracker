import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { LoadingService } from '../../core/services/loading.service';
import { NotificationService } from '../../core/services/notification.service';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss']
})
export class ExpensesComponent implements OnInit, OnDestroy {
  expenses: Expense[] = [];
  categories: Category[] = [];
  newExpense: Expense = {
    id: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
    paymentMethod: '',
    tags: [],
    priority: 'medium',
    notes: '',
    location: '',
    receiptNumber: ''
  };

  // Filter properties
  filterAmount: string = '';
  filterCategory: string = '';
  filterDate: string = '';
  filterDateFrom: string = '';
  filterDateTo: string = '';
  sortBy: 'date' | 'amount' | 'description' = 'date';
  sortOrder: 'asc' | 'desc' = 'desc';

  private subscription: Subscription = new Subscription();

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private loadingService: LoadingService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  async loadData() {
    this.loadingService.show('Loading expenses...');
    
    try {
      console.log('Loading data from Firebase...');
      
      // Force reload from Firebase by calling the services directly
      const expenses = await this.expenseService.getAll();
      const categories = await this.categoryService.getAll();

      this.expenses = expenses;
      this.categories = categories;
      
      console.log(`Loaded ${this.expenses.length} expenses and ${this.categories.length} categories`);
      
      this.notificationService.success(
        'Expenses Loaded! 📝',
        `Found ${this.expenses.length} expenses in your records.`,
        '✅'
      );
    } catch (error) {
      console.error('Error loading data:', error);
      this.notificationService.handleError(error, 'Expenses');
    } finally {
      this.loadingService.hide();
    }
  }

  async addExpense() {
    if (!this.validateExpense()) {
      return;
    }

    this.loadingService.show('Adding expense...');
    
    try {
      const expenseData: Omit<Expense, 'id'> = {
        description: this.newExpense.description,
        amount: parseFloat(this.newExpense.amount.toString()),
        date: this.newExpense.date,
        categoryId: this.newExpense.categoryId,
        paymentMethod: this.newExpense.paymentMethod || 'Cash',
        tags: this.newExpense.tags || [],
        priority: this.newExpense.priority || 'medium',
        notes: this.newExpense.notes || '',
        location: this.newExpense.location || '',
        receiptNumber: this.newExpense.receiptNumber || ''
      };

      const id = await this.expenseService.add(expenseData);
      console.log(`Expense added with Firebase ID: ${id}`);
      
      // Reload data to update the component immediately
      await this.loadData();
      
      this.resetForm();
      this.notificationService.expenseAdded(expenseData.amount);
      
      // Check for achievements
      this.checkAchievements();
    } catch (error) {
      this.notificationService.handleError(error, 'Add Expense');
    } finally {
      this.loadingService.hide();
    }
  }

  async editExpense(expense: Expense) {
    this.loadingService.show('Opening expense editor...');
    
    try {
      // Simplified edit - only description and amount
      const description = window.prompt('Description:', expense.description) || expense.description;
      const amountStr = window.prompt('Amount (₹):', expense.amount.toString()) || expense.amount.toString();
      
      // Validate amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        this.notificationService.error('Invalid Amount!', 'Please enter a valid number greater than 0.');
        return;
      }

      const updatedExpense: Expense = {
        ...expense,
        description,
        amount: amount
      };

      await this.expenseService.update(updatedExpense);
      await this.loadData(); // Reload data after updating
      
      this.notificationService.expenseUpdated(updatedExpense.amount);
    } catch (error) {
      this.notificationService.handleError(error, 'Edit Expense');
    } finally {
      this.loadingService.hide();
    }
  }

  async deleteExpense(expense: Expense) {
    const confirmed = window.confirm(`Are you sure you want to delete "${expense.description}" (₹${expense.amount})?`);
    if (!confirmed) return;

    this.loadingService.show('Deleting expense...');

    try {
      await this.expenseService.delete(expense.id);
      await this.loadData(); // Reload data after deleting
      
      this.notificationService.expenseDeleted();
    } catch (error) {
      this.notificationService.handleError(error, 'Delete Expense');
    } finally {
      this.loadingService.hide();
    }
  }

  validateExpense(): boolean {
    if (!this.newExpense.description?.trim()) {
      this.notificationService.error('Validation Error', 'Please enter a description.');
      return false;
    }

    if (!this.newExpense.amount || this.newExpense.amount <= 0) {
      this.notificationService.error('Validation Error', 'Please enter a valid amount greater than 0.');
      return false;
    }

    if (!this.newExpense.categoryId) {
      this.notificationService.error('Validation Error', 'Please select a category.');
      return false;
    }

    if (!this.newExpense.date) {
      this.notificationService.error('Validation Error', 'Please select a date.');
      return false;
    }

    return true;
  }

  resetForm() {
    this.newExpense = {
      id: '',
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      categoryId: '',
      paymentMethod: '',
      tags: [],
      priority: 'medium',
      notes: '',
      location: '',
      receiptNumber: ''
    };
  }

  getFilteredExpenses(): Expense[] {
    let filtered = [...this.expenses];

    // Filter by amount
    if (this.filterAmount) {
      const amount = parseFloat(this.filterAmount);
      if (!isNaN(amount)) {
        filtered = filtered.filter(e => e.amount >= amount);
      }
    }

    // Filter by category
    if (this.filterCategory) {
      filtered = filtered.filter(e => e.categoryId === this.filterCategory);
    }

    // Filter by date range
    if (this.filterDateFrom || this.filterDateTo) {
      filtered = filtered.filter(e => {
        const expenseDate = new Date(e.date);
        const fromDate = this.filterDateFrom ? new Date(this.filterDateFrom) : null;
        const toDate = this.filterDateTo ? new Date(this.filterDateTo) : null;
        
        if (fromDate && toDate) {
          return expenseDate >= fromDate && expenseDate <= toDate;
        } else if (fromDate) {
          return expenseDate >= fromDate;
        } else if (toDate) {
          return expenseDate <= toDate;
        }
        return true;
      });
    } else if (this.filterDate) {
      // Fallback to single date filter
      filtered = filtered.filter(e => e.date === this.filterDate);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (this.sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'description':
          aValue = (a.description || '').toLowerCase();
          bValue = (b.description || '').toLowerCase();
          break;
        default:
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
      }

      if (this.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }

  getCategoryName(id: string): string {
    const category = this.categories.find(c => c.id === id);
    return category?.name || 'Unknown';
  }

  getCategoryColor(id: string): string {
    const category = this.categories.find(c => c.id === id);
    return category?.color || '#999';
  }

  getCategoryIcon(id: string): string {
    const category = this.categories.find(c => c.id === id);
    return category?.icon || '📌';
  }

  clearFilters() {
    this.filterAmount = '';
    this.filterCategory = '';
    this.filterDate = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
  }

  clearCategory() {
    this.newExpense.categoryId = '';
  }

  getTotalAmount(): number {
    return this.getFilteredExpenses().reduce((sum, e) => sum + e.amount, 0);
  }

  getAverageAmount(): number {
    const filtered = this.getFilteredExpenses();
    return filtered.length > 0 ? filtered.reduce((sum, e) => sum + e.amount, 0) / filtered.length : 0;
  }

  getExpenseCount(): number {
    return this.getFilteredExpenses().length;
  }

  checkAchievements() {
    const totalExpenses = this.expenses.length;
    
    // Check for milestone achievements
    if (totalExpenses === 10) {
      this.notificationService.achievement(
        '10 Expenses Milestone! 🎯',
        'Congratulations! You\'ve logged your 10th expense. Keep up the great tracking!',
        '🎉'
      );
    } else if (totalExpenses === 50) {
      this.notificationService.achievement(
        '50 Expenses Milestone! 🏆',
        'Amazing! You\'ve logged 50 expenses. You\'re becoming a tracking expert!',
        '🏆'
      );
    } else if (totalExpenses === 100) {
      this.notificationService.achievement(
        '100 Expenses Milestone! 💎',
        'Incredible! You\'ve logged 100 expenses. You\'re a financial tracking master!',
        '💎'
      );
    }

    // Check for category mastery
    const categoryCounts: { [key: string]: number } = {};
    this.expenses.forEach(expense => {
      categoryCounts[expense.categoryId] = (categoryCounts[expense.categoryId] || 0) + 1;
    });

    Object.entries(categoryCounts).forEach(([categoryId, count]) => {
      if (count === 10) {
        const categoryName = this.getCategoryName(categoryId);
        this.notificationService.categoryMastery(categoryName);
      }
    });

    // Check for daily streak
    this.checkDailyStreak();
  }

  checkDailyStreak() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const hasTodayExpense = this.expenses.some(e => e.date === today);
    const hasYesterdayExpense = this.expenses.some(e => e.date === yesterday);
    
    if (hasTodayExpense && hasYesterdayExpense) {
      // Calculate streak
      let streak = 1;
      let currentDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      while (true) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const hasExpense = this.expenses.some(e => e.date === dateStr);
        
        if (hasExpense) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
      
      if (streak >= 7) {
        this.notificationService.streakAchievement(streak);
      }
    }
  }

  generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Monthly expense methods
  getMonthlyExpenses(): { [key: string]: Expense[] } {
    const monthlyExpenses: { [key: string]: Expense[] } = {};
    
    this.expenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyExpenses[monthKey]) {
        monthlyExpenses[monthKey] = [];
      }
      monthlyExpenses[monthKey].push(expense);
    });
    
    return monthlyExpenses;
  }

  getCurrentMonthExpenses(): Expense[] {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    return this.expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
    });
  }

  getCurrentMonthTotal(): number {
    return this.getCurrentMonthExpenses().reduce((sum, e) => sum + e.amount, 0);
  }

  getPreviousMonthExpenses(): Expense[] {
    const currentDate = new Date();
    const previousMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
    const previousYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();
    
    return this.expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === previousMonth && expenseDate.getFullYear() === previousYear;
    });
  }

  getPreviousMonthTotal(): number {
    return this.getPreviousMonthExpenses().reduce((sum, e) => sum + e.amount, 0);
  }

  getMonthlyComparison(): { change: number, percentage: number, hasPreviousData: boolean } {
    const currentTotal = this.getCurrentMonthTotal();
    const previousTotal = this.getPreviousMonthTotal();
    
    if (previousTotal === 0) {
      return { change: 0, percentage: 0, hasPreviousData: false };
    }
    
    const change = currentTotal - previousTotal;
    const percentage = (change / previousTotal) * 100;
    
    return { change, percentage, hasPreviousData: true };
  }

  getMonthlyReport(): any[] {
    const monthlyExpenses = this.getMonthlyExpenses();
    const reports: any[] = [];
    
    Object.entries(monthlyExpenses).forEach(([monthKey, expenses]) => {
      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      const average = total / expenses.length;
      const categoryBreakdown = this.getCategoryBreakdown(expenses);
      
      reports.push({
        month: monthKey,
        total,
        average,
        count: expenses.length,
        categoryBreakdown
      });
    });
    
    return reports.sort((a, b) => b.month.localeCompare(a.month));
  }

  getCategoryBreakdown(expenses: Expense[]): any[] {
    const breakdown: { [key: string]: number } = {};
    
    expenses.forEach(expense => {
      breakdown[expense.categoryId] = (breakdown[expense.categoryId] || 0) + expense.amount;
    });
    
    return Object.entries(breakdown).map(([categoryId, amount]) => ({
      categoryId,
      categoryName: this.getCategoryName(categoryId),
      amount,
      percentage: (amount / expenses.reduce((sum, e) => sum + e.amount, 0)) * 100
    }));
  }
} 