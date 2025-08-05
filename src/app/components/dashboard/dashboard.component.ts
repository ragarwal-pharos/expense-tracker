import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { FirebaseService } from '../../core/services/firebase.service';
import { Subscription } from 'rxjs';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';

interface Alert {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  icon: string;
}

interface SpendingTrend {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  icon: string;
}

interface BudgetProgress {
  percentage: number;
  remaining: number;
  status: 'good' | 'warning' | 'danger';
}

interface CategoryTrend {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  icon: string;
}

interface MonthlyTrend {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

interface Insight {
  title: string;
  description: string;
}

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
  
  // New features
  showInsights: boolean = false;
  
  private subscription: Subscription = new Subscription();

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private firebaseService: FirebaseService,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to Firebase observables for real-time updates
    this.subscription.add(
      this.firebaseService.expenses$.subscribe(expenses => {
        this.expenses = expenses;
        this.calculateTotals();
        this.calculateCategoryBreakdown();
        this.getRecentExpenses();
        this.calculateMonthlyData();
        this.calculateWeeklyData();
        console.log(`Received ${expenses.length} expenses from Firebase`);
      })
    );

    this.subscription.add(
      this.firebaseService.categories$.subscribe(categories => {
        this.categories = categories;
        console.log(`Received ${categories.length} categories from Firebase`);
      })
    );

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
      
      switch (this.selectedPeriod) {
        case 'monthly':
          // Current month expenses
          filtered = filtered.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === now.getMonth() && 
                   expenseDate.getFullYear() === now.getFullYear();
          });
          break;
        case 'yearly':
          // Current year expenses
          filtered = filtered.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === now.getFullYear();
          });
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
    }
    
    return filtered;
  }

  getFilteredTotal(): number {
    return this.getFilteredExpenses().reduce((sum, expense) => sum + expense.amount, 0);
  }

  getFilterLabel(): string {
    switch (this.selectedPeriod) {
      case 'monthly': return 'This Month';
      case 'yearly': return 'This Year';
      case 'custom': return 'Custom Period';
      default: return 'All Time';
    }
  }

  onFilterChange() {
    // Trigger change detection
  }

  getExpensesByCategory(categoryId: string): Expense[] {
    return this.getFilteredExpenses().filter(expense => expense.categoryId === categoryId);
  }

  get categoryTotals(): { [key: string]: number } {
    const totals: { [key: string]: number } = {};
    const filteredExpenses = this.getFilteredExpenses();
    this.categories.forEach(category => {
      totals[category.id] = filteredExpenses
        .filter(expense => expense.categoryId === category.id)
        .reduce((sum, expense) => sum + expense.amount, 0);
    });
    return totals;
  }

  getMonthlyComparison(): { change: number; percentage: number; hasPreviousData: boolean; status: string } {
    const hasPreviousData = this.previousMonthTotal > 0;
    let status = '';
    
    if (!hasPreviousData && this.currentMonthTotal > 0) {
      status = 'First Month';
    } else if (hasPreviousData) {
      if (this.monthlyChange > 0) {
        status = 'Increased';
      } else if (this.monthlyChange < 0) {
        status = 'Decreased';
      } else {
        status = 'No Change';
      }
    }
    
    return {
      change: this.monthlyChange,
      percentage: parseFloat(this.monthlyChangePercentage.toFixed(2)),
      hasPreviousData: hasPreviousData,
      status: status
    };
  }

  get monthlyTotal(): number {
    return this.currentMonthTotal;
  }

  // Get recent expenses sorted by date (most recent first)
  getRecentExpensesSorted(): Expense[] {
    return [...this.expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort by date descending
      .slice(0, 5);
  }

  // Get filtered expenses sorted by amount in descending order
  getFilteredExpensesSorted(): Expense[] {
    return this.getFilteredExpenses()
      .sort((a, b) => b.amount - a.amount); // Sort by amount descending
  }

  // Get categories sorted by total expense amount in descending order (only categories with expenses)
  getCategoriesSortedByExpense(): Category[] {
    return [...this.categories]
      .filter(category => {
        const total = this.categoryTotals[category.id] || 0;
        return total > 0; // Only include categories with expenses
      })
      .sort((a, b) => {
        const aTotal = this.categoryTotals[a.id] || 0;
        const bTotal = this.categoryTotals[b.id] || 0;
        return bTotal - aTotal; // Sort by amount descending
      });
  }

  // New enhanced functionality

  // Smart Alerts
  getAlerts(): Alert[] {
    const alerts: Alert[] = [];
    
    // High spending alert - show actual percentage
    if (this.previousMonthTotal > 0 && this.currentMonthTotal > this.previousMonthTotal) {
      const increasePercentage = ((this.currentMonthTotal - this.previousMonthTotal) / this.previousMonthTotal) * 100;
      if (increasePercentage > 10) {
        alerts.push({
          type: 'error',
          message: `Your spending is ${increasePercentage.toFixed(2)}% higher than last month`,
          icon: '📈'
        });
      }
    }
    
    // Good spending alert - show actual percentage
    if (this.previousMonthTotal > 0 && this.currentMonthTotal < this.previousMonthTotal) {
      const decreasePercentage = ((this.previousMonthTotal - this.currentMonthTotal) / this.previousMonthTotal) * 100;
      if (decreasePercentage > 10) {
        alerts.push({
          type: 'success',
          message: `Great job! You've reduced spending by ${decreasePercentage.toFixed(2)}% compared to last month`,
          icon: '🎉'
        });
      }
    }
    
    return alerts;
  }

  // Spending Trends
  getSpendingTrend(): SpendingTrend | null {
    if (this.previousMonthTotal === 0) return null;
    
    const percentage = this.monthlyChangePercentage;
    if (percentage > 10) {
      return { direction: 'up', percentage: parseFloat(percentage.toFixed(2)), icon: '📈' };
    } else if (percentage < -10) {
      return { direction: 'down', percentage: parseFloat(Math.abs(percentage).toFixed(2)), icon: '📉' };
    } else {
      return { direction: 'stable', percentage: parseFloat(Math.abs(percentage).toFixed(2)), icon: '➡️' };
    }
  }

  // Budget Progress - Return null since no budget is set
  getBudgetProgress(): BudgetProgress | null {
    return null; // No budget set by user
  }

  // Daily Average
  getDailyAverage(): number | null {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const daysPassed = new Date().getDate();
    return this.currentMonthTotal / daysPassed;
  }

  // Potential Savings - Return 0 since no budget is set
  getPotentialSavings(): number {
    return 0; // No budget set by user
  }

  // Savings Tip - Return null since no budget is set
  getSavingsTip(): string | null {
    return null; // No budget set by user
  }

  // Category Percentage
  getCategoryPercentage(categoryId: string): number {
    const total = this.getFilteredTotal();
    if (total === 0) return 0;
    const categoryTotal = this.categoryTotals[categoryId] || 0;
    return parseFloat(((categoryTotal / total) * 100).toFixed(2));
  }

  // Category Trend - Return null to hide trend percentages
  getCategoryTrend(categoryId: string): CategoryTrend | null {
    return null; // Hide trend percentages
  }

  // Insights
  getTopSpendingCategory(): { name: string; amount: number } | null {
    const sortedCategories = this.categoryBreakdown.sort((a, b) => b.amount - a.amount);
    if (sortedCategories.length === 0) return null;
    
    return {
      name: sortedCategories[0].categoryName,
      amount: sortedCategories[0].amount
    };
  }

  getSpendingPattern(): string {
    const avgAmount = this.getFilteredTotal() / Math.max(this.getFilteredExpenses().length, 1);
    if (avgAmount > 1000) return 'High Value';
    if (avgAmount > 500) return 'Medium Value';
    return 'Low Value';
  }

  getPatternDescription(): string {
    const pattern = this.getSpendingPattern();
    switch (pattern) {
      case 'High Value': return 'Large individual expenses';
      case 'Medium Value': return 'Moderate spending pattern';
      case 'Low Value': return 'Small frequent expenses';
      default: return 'Balanced spending';
    }
  }

  getQuickWin(): Insight | null {
    const topCategory = this.getTopSpendingCategory();
    if (topCategory && topCategory.amount > this.monthlyTotal * 0.4) {
      return {
        title: `Reduce ${topCategory.name} spending`,
        description: `This category represents ${((topCategory.amount / this.getFilteredTotal()) * 100).toFixed(1)}% of your expenses`
      };
    }
    return null;
  }

  getAchievement(): Insight | null {
    if (this.currentMonthTotal < this.previousMonthTotal * 0.8 && this.previousMonthTotal > 0) {
      return {
        title: 'Spending Reduction Champion!',
        description: 'You\'ve reduced spending by over 20% this month'
      };
    }
    if (this.currentMonthTotal < this.monthlyTotal * 0.5) {
      return {
        title: 'Budget Master!',
        description: 'You\'re under 50% of your monthly budget'
      };
    }
    return null;
  }

  // Monthly Trends Chart
  getMonthlyTrends(): MonthlyTrend[] {
    const months = [];
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      const monthExpenses = this.expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === date.getMonth() && 
               expenseDate.getFullYear() === date.getFullYear();
      });
      
      const amount = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const maxAmount = Math.max(...this.getMonthlyAmounts());
      const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
      
      months.push({
        name: date.toLocaleDateString('en-US', { month: 'short' }),
        amount,
        percentage,
        color: colors[i]
      });
    }
    
    return months;
  }

  private getMonthlyAmounts(): number[] {
    const amounts = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      const monthExpenses = this.expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === date.getMonth() && 
               expenseDate.getFullYear() === date.getFullYear();
      });
      
      amounts.push(monthExpenses.reduce((sum, expense) => sum + expense.amount, 0));
    }
    return amounts;
  }

  // Actions
  exportData(): void {
    const data = {
      expenses: this.expenses,
      categories: this.categories,
      summary: {
        totalSpent: this.totalSpent,
        monthlyTotal: this.monthlyTotal,
        weeklyTotal: this.weeklyTotal
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  viewAllExpenses(): void {
    // Navigate to expenses page
    this.router.navigate(['/expenses']);
  }

  editExpense(expense: Expense): void {
    try {
      // Simplified edit - description, amount, and date
      const description = window.prompt('Description:', expense.description) || expense.description;
      const amountStr = window.prompt('Amount (₹):', expense.amount.toString()) || expense.amount.toString();
      const dateStr = window.prompt('Date (YYYY-MM-DD):', expense.date) || expense.date;
      
      // Validate amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        alert('Invalid Amount! Please enter a valid number greater than 0.');
        return;
      }

      // Validate date
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        alert('Invalid Date! Please enter date in YYYY-MM-DD format (e.g., 2024-01-15).');
        return;
      }

      const updatedExpense: Expense = {
        ...expense,
        description,
        amount: amount,
        date: dateStr
      };

      this.expenseService.update(updatedExpense).then(() => {
        console.log('Expense updated successfully');
      }).catch(error => {
        console.error('Error updating expense:', error);
        alert('Error updating expense. Please try again.');
      });
      
    } catch (error) {
      console.error('Error editing expense:', error);
      alert('Error editing expense. Please try again.');
    }
  }

  deleteExpense(expense: Expense): void {
    // Show confirmation dialog
    const confirmDelete = window.confirm(`Are you sure you want to delete this expense?\n\nDescription: ${expense.description}\nAmount: ₹${expense.amount}\nDate: ${expense.date}`);
    
    if (confirmDelete) {
      this.expenseService.delete(expense.id).then(() => {
        console.log('Expense deleted successfully');
        alert('Expense deleted successfully!');
      }).catch(error => {
        console.error('Error deleting expense:', error);
        alert('Error deleting expense. Please try again.');
      });
    }
  }
} 