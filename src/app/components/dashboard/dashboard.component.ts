import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { Subscription } from 'rxjs';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  expenses: Expense[] = [];
  categories: Category[] = [];
  
  // Summary data
  totalSpent: number = 0;
  averageSpent: number = 0;
  expenseCount: number = 0;
  monthlyComparison: any = {};
  
  // Filter properties
  selectedPeriod: string = 'all';
  customStartDate: string = '';
  customEndDate: string = '';
  
  // Category breakdown
  categoryBreakdown: any[] = [];
  
  // Recent expenses
  recentExpenses: Expense[] = [];
  
  // Monthly data
  currentMonthTotal: number = 0;
  previousMonthTotal: number = 0;
  monthlyChange: number = 0;
  monthlyChangePercentage: number = 0;
  
  // Weekly data
  weeklyTotal: number = 0;
  
  private subscription: Subscription = new Subscription();

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  async loadData() {
    try {
      console.log('Loading dashboard data...');
      
      // Load expenses and categories
      this.expenses = await this.expenseService.getAll();
      this.categories = await this.categoryService.getAll();
      
      // Calculate summary data
      this.calculateTotals();
      this.calculateCategoryBreakdown();
      this.getRecentExpenses();
      this.calculateMonthlyData();
      this.calculateWeeklyData();
      
      console.log('Dashboard data loaded successfully');
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      
    }
  }

  calculateTotals() {
    this.totalSpent = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    this.expenseCount = this.expenses.length;
    this.averageSpent = this.expenseCount > 0 ? this.totalSpent / this.expenseCount : 0;
  }

  calculateCategoryBreakdown() {
    const breakdown: { [key: string]: number } = {};
    
    this.expenses.forEach(expense => {
      const categoryId = expense.categoryId;
      if (breakdown[categoryId]) {
        breakdown[categoryId] += expense.amount;
      } else {
        breakdown[categoryId] = expense.amount;
      }
    });
    
    this.categoryBreakdown = Object.entries(breakdown).map(([categoryId, amount]) => {
      const category = this.categories.find(c => c.id === categoryId);
      return {
        categoryId,
        categoryName: category?.name || 'Unknown',
        categoryColor: category?.color || '#666',
        categoryIcon: category?.icon || '📌',
        amount,
        percentage: (amount / this.totalSpent) * 100
      };
    }).sort((a, b) => b.amount - a.amount);
  }

  getRecentExpenses() {
    this.recentExpenses = [...this.expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }

  calculateMonthlyData() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Current month expenses
    this.currentMonthTotal = this.expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
    
    // Previous month expenses
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    this.previousMonthTotal = this.expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === previousMonth && expenseDate.getFullYear() === previousYear;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
    
    // Calculate change
    this.monthlyChange = this.currentMonthTotal - this.previousMonthTotal;
    this.monthlyChangePercentage = this.previousMonthTotal > 0 
      ? (this.monthlyChange / this.previousMonthTotal) * 100 
      : 0;
  }

  calculateWeeklyData() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    
    this.weeklyTotal = this.expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startOfWeek;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  }

  getCategoryColor(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.color || '#666';
  }

  getCategoryIcon(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.icon || '📌';
  }

  // Filter methods
  getFilteredExpenses(): Expense[] {
    let filtered = [...this.expenses];
    
    // Apply period filter
    if (this.selectedPeriod !== 'all') {
      const now = new Date();
      const startDate = new Date();
      
      switch (this.selectedPeriod) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'custom':
          if (this.customStartDate && this.customEndDate) {
            filtered = filtered.filter(expense => {
              const expenseDate = new Date(expense.date);
              const start = new Date(this.customStartDate);
              const end = new Date(this.customEndDate);
              return expenseDate >= start && expenseDate <= end;
            });
          }
          break;
      }
      
      if (this.selectedPeriod !== 'custom') {
        filtered = filtered.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate >= startDate;
        });
      }
    }
    
    return filtered;
  }

  getFilteredTotal(): number {
    return this.getFilteredExpenses().reduce((sum, expense) => sum + expense.amount, 0);
  }

  getFilterLabel(): string {
    switch (this.selectedPeriod) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'custom': return 'Custom Period';
      default: return 'All Time';
    }
  }

  onFilterChange() {
    // Trigger change detection
  }

  getExpensesByCategory(categoryId: string): Expense[] {
    return this.expenses.filter(expense => expense.categoryId === categoryId);
  }

  get categoryTotals(): { [key: string]: number } {
    const totals: { [key: string]: number } = {};
    this.categories.forEach(category => {
      totals[category.id] = this.getExpensesByCategory(category.id).reduce((sum, expense) => sum + expense.amount, 0);
    });
    return totals;
  }

  getMonthlyComparison(): { change: number; percentage: number; hasPreviousData: boolean } {
    const hasPreviousData = this.previousMonthTotal > 0;
    return {
      change: this.monthlyChange,
      percentage: this.monthlyChangePercentage,
      hasPreviousData: hasPreviousData
    };
  }

  get monthlyTotal(): number {
    return this.currentMonthTotal;
  }
} 