import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { FirebaseService } from '../../core/services/firebase.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { DialogService } from '../../core/services/dialog.service';
import { Subscription } from 'rxjs';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';

interface Alert {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
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
  imports: [CommonModule, FormsModule, RouterModule],
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
  selectedMonth: string = '';
  selectedYear: string = '';
  customStartDate: string = '';
  customEndDate: string = '';
  selectedMonthOnly: string = '';
  selectedYearOnly: string = '';
  
  // Category breakdown
  categoryBreakdown: any[] = [];
  
  // Recent expenses
  recentExpenses: Expense[] = [];
  
  // Monthly data
  currentMonthTotal: number = 0;
  
  // Weekly data
  weeklyTotal: number = 0;
  
  // New features
  showInsights: boolean = false;
  
  // Loading states
  isLoading: boolean = true;
  
  private subscription: Subscription = new Subscription();

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private firebaseService: FirebaseService,
    private filterStateService: FilterStateService,
    private dialogService: DialogService,
    private router: Router
  ) {}

  ngOnInit() {
    // Load filter state from service
    this.loadFilterState();
    
    // Initialize available years
    const currentYear = new Date().getFullYear();
    for (let year = 2020; year <= currentYear + 1; year++) {
      this.availableYears.push(year.toString());
    }
    
    // Subscribe to Firebase observables for real-time updates
    this.subscription.add(
      this.firebaseService.expenses$.subscribe(expenses => {
        this.expenses = expenses;
        this.calculateTotals();
        this.calculateCategoryBreakdown();
        this.getRecentExpenses();
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
      this.isLoading = true;
      console.log('Loading dashboard data...');
      
      // Load expenses and categories
      this.expenses = await this.expenseService.getAll();
      this.categories = await this.categoryService.getAll();
      
      // Calculate summary data
      this.calculateTotals();
      this.calculateCategoryBreakdown();
      this.getRecentExpenses();
      this.calculateWeeklyData();
      
      console.log('Dashboard data loaded successfully');
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      this.isLoading = false;
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
    const filteredExpenses = this.getFilteredExpenses();
    this.recentExpenses = [...filteredExpenses]
      .sort((a, b) => {
        // Ensure proper date parsing and handle potential timezone issues
        const dateA = new Date(a.date + 'T00:00:00');
        const dateB = new Date(b.date + 'T00:00:00');
        
        // First sort by date descending (latest first)
        const dateComparison = dateB.getTime() - dateA.getTime();
        
        // If dates are the same, sort by creation timestamp (newer expenses come first)
        if (dateComparison === 0) {
          // If both have createdAt, sort by timestamp
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          // If only one has createdAt, prioritize the one with timestamp (newer)
          else if (a.createdAt && !b.createdAt) {
            return -1; // a comes first (has timestamp)
          }
          else if (!a.createdAt && b.createdAt) {
            return 1; // b comes first (has timestamp)
          }
          // If neither has createdAt, fall back to ID comparison
          else {
            return b.id.localeCompare(a.id);
          }
        }
        
        return dateComparison;
      })
      .slice(0, 5);
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

  getCategoryAmountColor(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.color || '#3b82f6'; // Default blue color
  }

  // Filter methods
  getFilteredExpenses(): Expense[] {
    let filtered = [...this.expenses];
    
    // Apply period filter
    if (this.selectedPeriod !== 'all') {
      const now = new Date();
      
      switch (this.selectedPeriod) {
        case 'monthly':
          // Selected month expenses
          const selectedMonthIndex = parseInt(this.selectedMonth);
          const selectedYear = parseInt(this.selectedYear);
          filtered = filtered.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === selectedMonthIndex && 
                   expenseDate.getFullYear() === selectedYear;
          });
          break;
        case 'yearly':
          // Current year expenses
          filtered = filtered.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === now.getFullYear();
          });
          break;
        case 'last30':
          // Last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          filtered = filtered.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= thirtyDaysAgo;
          });
          break;
        case 'last7':
          // Last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          filtered = filtered.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= sevenDaysAgo;
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
        case 'monthOnly':
          if (this.selectedMonthOnly && this.selectedYearOnly) {
            const monthIndex = parseInt(this.selectedMonthOnly);
            const year = parseInt(this.selectedYearOnly);
            filtered = filtered.filter(expense => {
              const expenseDate = new Date(expense.date);
              return expenseDate.getMonth() === monthIndex && 
                     expenseDate.getFullYear() === year;
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
      case 'last30': return 'Last 30 Days';
      case 'last7': return 'Last 7 Days';
      case 'custom': return this.getCustomDateRangeLabel();
      default: return 'All Time';
    }
  }

  getCustomDateRangeLabel(): string {
    if (!this.customStartDate || !this.customEndDate) {
      return 'Custom Range';
    }
    
    const startDate = new Date(this.customStartDate);
    const endDate = new Date(this.customEndDate);
    
    const startFormatted = startDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    const endFormatted = endDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    
    return `${startFormatted} - ${endFormatted}`;
  }

  // Load filter state from service
  loadFilterState() {
    const filterState = this.filterStateService.getFilterState();
    console.log('Loading filter state from service:', filterState);
    
    this.selectedPeriod = filterState.selectedPeriod;
    this.selectedMonth = filterState.selectedMonth;
    this.selectedYear = filterState.selectedYear;
    this.customStartDate = filterState.customStartDate;
    this.customEndDate = filterState.customEndDate;
    this.selectedMonthOnly = filterState.selectedMonthOnly || '';
    this.selectedYearOnly = filterState.selectedYearOnly || '';
    
    // Auto-select current month and year if "Month Only" is selected but no month/year is set
    if (this.selectedPeriod === 'monthOnly' && (!this.selectedMonthOnly || !this.selectedYearOnly)) {
      const now = new Date();
      this.selectedMonthOnly = now.getMonth().toString();
      this.selectedYearOnly = now.getFullYear().toString();
      console.log('Auto-selected current month and year on load:', { month: this.selectedMonthOnly, year: this.selectedYearOnly });
      
      // Trigger the month only change to set the date range
      this.onMonthOnlyChange();
    }
    
    console.log('Filter state loaded into component:', {
      selectedPeriod: this.selectedPeriod,
      selectedMonth: this.selectedMonth,
      selectedYear: this.selectedYear,
      customStartDate: this.customStartDate,
      customEndDate: this.customEndDate,
      selectedMonthOnly: this.selectedMonthOnly,
      selectedYearOnly: this.selectedYearOnly
    });
  }

  onFilterChange() {
    console.log('Filter changed, saving state:', {
      selectedPeriod: this.selectedPeriod,
      selectedMonth: this.selectedMonth,
      selectedYear: this.selectedYear,
      customStartDate: this.customStartDate,
      customEndDate: this.customEndDate
    });
    
    // Auto-select current month and year when "Month Only" is selected
    if (this.selectedPeriod === 'monthOnly') {
      const now = new Date();
      this.selectedMonthOnly = now.getMonth().toString();
      this.selectedYearOnly = now.getFullYear().toString();
      console.log('Auto-selected current month and year:', { month: this.selectedMonthOnly, year: this.selectedYearOnly });
      
      // Trigger the month only change to set the date range
      this.onMonthOnlyChange();
    }
    
    // Save filter state to service
    this.filterStateService.updateFilterState({
      selectedPeriod: this.selectedPeriod,
      selectedMonth: this.selectedMonth,
      selectedYear: this.selectedYear,
      customStartDate: this.customStartDate,
      customEndDate: this.customEndDate,
      selectedMonthOnly: this.selectedMonthOnly,
      selectedYearOnly: this.selectedYearOnly
    });
  }

  // Custom date range methods
  onCustomDateChange() {
    // This method is called when either start or end date changes
    console.log('Custom date changed:', { start: this.customStartDate, end: this.customEndDate });
    
    // Automatically apply the filter when both dates are selected and valid
    if (this.customStartDate && this.customEndDate && this.isCustomDateRangeValid()) {
      console.log('Auto-applying custom date range filter');
      this.onFilterChange();
    }
  }

  onMonthOnlyChange() {
    console.log('Month only changed:', { month: this.selectedMonthOnly, year: this.selectedYearOnly });
    if (this.selectedMonthOnly && this.selectedYearOnly) {
      // Set the custom date range to the selected month
      const monthIndex = parseInt(this.selectedMonthOnly);
      const year = parseInt(this.selectedYearOnly);
      
      // Create start date (first day of the month) - use UTC to avoid timezone issues
      const startDate = new Date(Date.UTC(year, monthIndex, 1));
      
      // Create end date (last day of the month) - use UTC to avoid timezone issues
      const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
      
      // Format dates as YYYY-MM-DD using UTC methods to avoid timezone issues
      const formatDate = (date: Date) => {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      // Debug the date calculations
      console.log('Date calculations:', {
        monthIndex,
        year,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startDateMonth: startDate.getUTCMonth(),
        startDateDate: startDate.getUTCDate(),
        endDateMonth: endDate.getUTCMonth(),
        endDateDate: endDate.getUTCDate()
      });
      
      this.customStartDate = formatDate(startDate);
      this.customEndDate = formatDate(endDate);
      
      console.log('Month only filter applied:', { 
        month: monthIndex, 
        year: year, 
        startDate: this.customStartDate, 
        endDate: this.customEndDate 
      });
      
      // Save filter state directly without calling onFilterChange to avoid recursion
      this.filterStateService.updateFilterState({
        selectedPeriod: this.selectedPeriod,
        selectedMonth: this.selectedMonth,
        selectedYear: this.selectedYear,
        customStartDate: this.customStartDate,
        customEndDate: this.customEndDate,
        selectedMonthOnly: this.selectedMonthOnly,
        selectedYearOnly: this.selectedYearOnly
      });
      
      // Force a small delay to ensure state is synchronized
      setTimeout(() => {
        console.log('Month only filter state after delay:', {
          selectedPeriod: this.selectedPeriod,
          selectedMonthOnly: this.selectedMonthOnly,
          selectedYearOnly: this.selectedYearOnly,
          customStartDate: this.customStartDate,
          customEndDate: this.customEndDate
        });
      }, 100);
    }
  }

  isCustomDateRangeValid(): boolean {
    if (!this.customStartDate || !this.customEndDate) {
      return false;
    }
    
    const startDate = new Date(this.customStartDate);
    const endDate = new Date(this.customEndDate);
    
    return startDate <= endDate;
  }



  clearCustomDateRange() {
    this.customStartDate = '';
    this.customEndDate = '';
    console.log('Custom date range cleared');
    
    // Trigger change detection
    this.onFilterChange();
  }

  // Legacy method for backward compatibility
  openDatePicker() {
    // Set default date range (last 30 days)
    this.setDefaultDateRange('last30');
  }

  // Set default date ranges
  setDefaultDateRange(range: 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth') {
    const today = new Date();
    let startDate: Date;
    
    switch (range) {
      case 'last7':
        startDate = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case 'last30':
        startDate = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case 'last90':
        startDate = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000));
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        this.customStartDate = startDate.toISOString().split('T')[0];
        this.customEndDate = endDate.toISOString().split('T')[0];
        this.onFilterChange();
        return;
    }
    
    this.customStartDate = startDate.toISOString().split('T')[0];
    this.customEndDate = today.toISOString().split('T')[0];
    
    console.log(`Default date range set (${range}):`, { start: this.customStartDate, end: this.customEndDate });
    
    // Apply the filter
    this.onFilterChange();
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



  get monthlyTotal(): number {
    return this.currentMonthTotal;
  }

  // Get recent expenses sorted by date (most recent first) - using filtered expenses
  getRecentExpensesSorted(): Expense[] {
    const filteredExpenses = this.getFilteredExpenses();
    const sortedExpenses = [...filteredExpenses]
      .sort((a, b) => {
        // Ensure proper date parsing and handle potential timezone issues
        const dateA = new Date(a.date + 'T00:00:00');
        const dateB = new Date(b.date + 'T00:00:00');
        
        // First sort by date descending (latest first)
        const dateComparison = dateB.getTime() - dateA.getTime();
        
        // If dates are the same, sort by creation timestamp (newer expenses come first)
        if (dateComparison === 0) {
          // If both have createdAt, sort by timestamp
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          // If only one has createdAt, prioritize the one with timestamp (newer)
          else if (a.createdAt && !b.createdAt) {
            return -1; // a comes first (has timestamp)
          }
          else if (!a.createdAt && b.createdAt) {
            return 1; // b comes first (has timestamp)
          }
          // If neither has createdAt, fall back to ID comparison
          else {
            return b.id.localeCompare(a.id);
          }
        }
        
        return dateComparison;
      })
      .slice(0, 5);
    
    // Debug logging to verify sorting
    if (sortedExpenses.length > 0) {
      console.log('Recent expenses sorted by date and creation time (latest first):', 
        sortedExpenses.map(e => ({ 
          date: e.date, 
          description: e.description, 
          amount: e.amount, 
          createdAt: e.createdAt ? new Date(e.createdAt).toLocaleTimeString() : 'N/A',
          id: e.id.substring(0, 8) + '...' 
        })));
    }
    
    return sortedExpenses;
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

  // Category Trend - Return null to hide trend percentages (legacy method)
  getCategoryTrendLegacy(categoryId: string): CategoryTrend | null {
    return null; // Hide trend percentages
  }

  // Insights
  getTopSpendingCategory(): { name: string; amount: number } | null {
    const filteredExpenses = this.getFilteredExpenses();
    if (filteredExpenses.length === 0) return null;
    
    // Calculate category breakdown for filtered expenses only
    const breakdown: { [key: string]: number } = {};
    
    filteredExpenses.forEach(expense => {
      const categoryId = expense.categoryId;
      if (breakdown[categoryId]) {
        breakdown[categoryId] += expense.amount;
      } else {
        breakdown[categoryId] = expense.amount;
      }
    });
    
    const categoryBreakdown = Object.entries(breakdown).map(([categoryId, amount]) => {
      const category = this.categories.find(c => c.id === categoryId);
      return {
        categoryId,
        categoryName: category?.name || 'Unknown',
        amount
      };
    }).sort((a, b) => b.amount - a.amount);
    
    if (categoryBreakdown.length === 0) return null;
    
    return {
      name: categoryBreakdown[0].categoryName,
      amount: categoryBreakdown[0].amount
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
  toggleInsights(): void {
    this.showInsights = !this.showInsights;
    
    // Scroll to insights section if showing insights
    if (this.showInsights) {
      setTimeout(() => {
        const insightsSection = document.getElementById('insights-section');
        if (insightsSection) {
          // Calculate offset to account for any fixed headers
          const offset = 80; // Adjust this value based on your header height
          const elementPosition = insightsSection.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - offset;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 150); // Slightly longer delay to ensure the section is fully rendered
    }
  }

  viewAllExpenses(): void {
    // Navigate to expenses page
    this.router.navigate(['/expenses']);
  }

  async editExpense(expense: Expense): Promise<void> {
    try {
      // Get updated description
      const description = await this.dialogService.prompt(
        'Enter expense description:',
        'Edit Expense',
        expense.description,
        'text',
        'Enter description...',
        'Description'
      );
      
      if (description === null) return; // User cancelled
      
      // Get updated amount
      const amountStr = await this.dialogService.prompt(
        'Enter expense amount:',
        'Edit Expense',
        expense.amount.toString(),
        'number',
        'Enter amount...',
        'Amount (₹)'
      );
      
      if (amountStr === null) return; // User cancelled
      
      // Get updated date
      const dateStr = await this.dialogService.prompt(
        'Enter expense date:',
        'Edit Expense',
        expense.date,
        'date',
        '',
        'Date'
      );
      
      if (dateStr === null) return; // User cancelled
      
      // Validate amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        await this.dialogService.error('Invalid Amount! Please enter a valid number greater than 0.');
        return;
      }

      // Validate date
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        await this.dialogService.error('Invalid Date! Please enter date in YYYY-MM-DD format (e.g., 2024-01-15).');
        return;
      }

      const updatedExpense: Expense = {
        ...expense,
        description,
        amount: amount,
        date: dateStr
      };

      await this.expenseService.update(updatedExpense);
      await this.dialogService.success('Expense updated successfully!');
      
    } catch (error) {
      console.error('Error editing expense:', error);
      await this.dialogService.error('Error updating expense. Please try again.');
    }
  }

  async deleteExpense(expense: Expense): Promise<void> {
    // Show confirmation dialog
    const confirmDelete = await this.dialogService.confirm(
      `Are you sure you want to delete this expense?\n\nDescription: ${expense.description}\nAmount: ₹${expense.amount}\nDate: ${expense.date}`,
      'Delete Expense'
    );
    
    if (confirmDelete) {
      // Show immediate feedback - remove from UI optimistically
      const originalExpenses = [...this.expenses];
      this.expenses = this.expenses.filter(e => e.id !== expense.id);
      
      try {
        await this.expenseService.delete(expense.id);
        await this.dialogService.success('Expense deleted successfully!');
      } catch (error) {
        console.error('Error deleting expense:', error);
        // Restore the expense if deletion failed
        this.expenses = originalExpenses;
        await this.dialogService.error('Error deleting expense. Please try again.');
      }
    }
  }

  // Enhanced Data Insights and Smart Features
  getSmartInsights(): Insight[] {
    const insights: Insight[] = [];
    
    // Spending Pattern Analysis
    const avgAmount = this.getFilteredTotal() / Math.max(this.getFilteredExpenses().length, 1);
    if (avgAmount > 1000) {
      insights.push({
        title: 'High-Value Spending Pattern',
        description: `Your average expense is ₹${avgAmount.toFixed(0)}, indicating large purchases. Consider breaking down big expenses.`
      });
    }
    
    // Category Concentration Warning
    const topCategory = this.getTopSpendingCategory();
    if (topCategory && (topCategory.amount / this.getFilteredTotal()) > 0.5) {
      insights.push({
        title: 'Category Concentration Alert',
        description: `${topCategory.name} represents ${((topCategory.amount / this.getFilteredTotal()) * 100).toFixed(1)}% of your spending. Consider diversifying.`
      });
    }
    
    // Weekly Spending Trend
    const weeklyAvg = this.weeklyTotal;
    if (weeklyAvg > this.currentMonthTotal / 4) {
      insights.push({
        title: 'High Weekly Spending',
        description: `This week's spending (₹${weeklyAvg.toFixed(0)}) is above average. Monitor your daily expenses.`
      });
    }
    
    // Savings Opportunity
    const potentialSavings = this.getPotentialSavings();
    if (potentialSavings > 0) {
      insights.push({
        title: 'Savings Opportunity',
        description: `You could save ₹${potentialSavings.toFixed(0)} by optimizing your spending patterns.`
      });
    }
    
    return insights;
  }

  // Quick Actions Data
  getQuickActions(): { title: string; action: string; icon: string; route?: string; method?: () => void }[] {
    return [
      {
        title: 'Add Expense',
        action: 'Quick Entry',
        icon: '➕',
        route: '/expenses'
      },
      {
        title: 'View Reports',
        action: 'Monthly Analysis',
        icon: '📊',
        route: '/reports'
      },
      {
        title: 'Manage Categories',
        action: 'Organize',
        icon: '🏷️',
        route: '/categories'
      },
      {
        title: 'Export Data',
        action: 'Download',
        icon: '📥',
        method: () => this.exportData()
      }
    ];
  }

  // Enhanced Spending Analytics
  getSpendingAnalytics(): any {
    const expenses = this.getFilteredExpenses();
    const total = this.getFilteredTotal();
    
    return {
      totalExpenses: expenses.length,
      totalAmount: total,
      averagePerExpense: expenses.length > 0 ? total / expenses.length : 0,
      highestExpense: Math.max(...expenses.map(e => e.amount)),
      lowestExpense: Math.min(...expenses.map(e => e.amount)),
      mostExpensiveCategory: this.getMostExpensiveCategory(),
      leastExpensiveCategory: this.getLeastExpensiveCategory(),
      spendingByDay: this.getSpendingByDay(),
      spendingByWeek: this.getSpendingByWeek(),
      spendingByMonth: this.getSpendingByMonth(),
      topExpenses: this.getTopExpenses(5),
      recentTrend: this.getRecentSpendingTrend()
    };
  }

  // Get most expensive category
  getMostExpensiveCategory(): { name: string; amount: number; percentage: number } | null {
    const categoryTotals = this.categoryTotals;
    const total = this.getFilteredTotal();
    if (total === 0) return null;
    
    const maxCategory = Object.entries(categoryTotals)
      .reduce((max, [id, amount]) => amount > max.amount ? { id, amount } : max, { id: '', amount: 0 });
    
    const category = this.categories.find(c => c.id === maxCategory.id);
    return {
      name: category?.name || 'Unknown',
      amount: maxCategory.amount,
      percentage: (maxCategory.amount / total) * 100
    };
  }

  // Get least expensive category
  getLeastExpensiveCategory(): { name: string; amount: number; percentage: number } | null {
    const categoryTotals = this.categoryTotals;
    const total = this.getFilteredTotal();
    if (total === 0) return null;
    
    const minCategory = Object.entries(categoryTotals)
      .reduce((min, [id, amount]) => amount < min.amount ? { id, amount } : min, { id: '', amount: Infinity });
    
    const category = this.categories.find(c => c.id === minCategory.id);
    return {
      name: category?.name || 'Unknown',
      amount: minCategory.amount,
      percentage: (minCategory.amount / total) * 100
    };
  }

  // Get spending by day of week
  getSpendingByDay(): { day: string; amount: number; count: number }[] {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const spendingByDay: { [key: string]: { amount: number; count: number } } = {};
    
    days.forEach(day => {
      spendingByDay[day] = { amount: 0, count: 0 };
    });
    
    this.getFilteredExpenses().forEach(expense => {
      const day = new Date(expense.date).toLocaleDateString('en-US', { weekday: 'long' });
      spendingByDay[day].amount += expense.amount;
      spendingByDay[day].count += 1;
    });
    
    return days.map(day => ({
      day,
      amount: spendingByDay[day].amount,
      count: spendingByDay[day].count
    }));
  }

  // Get spending by week
  getSpendingByWeek(): { week: string; amount: number; count: number }[] {
    const weeks: { [key: string]: { amount: number; count: number } } = {};
    
    this.getFilteredExpenses().forEach(expense => {
      const date = new Date(expense.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = { amount: 0, count: 0 };
      }
      weeks[weekKey].amount += expense.amount;
      weeks[weekKey].count += 1;
    });
    
    return Object.entries(weeks)
      .map(([week, data]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: data.amount,
        count: data.count
      }))
      .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime());
  }

  // Get spending by month
  getSpendingByMonth(): { month: string; amount: number; count: number }[] {
    const months: { [key: string]: { amount: number; count: number } } = {};
    
    this.getFilteredExpenses().forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!months[monthKey]) {
        months[monthKey] = { amount: 0, count: 0 };
      }
      months[monthKey].amount += expense.amount;
      months[monthKey].count += 1;
    });
    
    return Object.entries(months)
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        amount: data.amount,
        count: data.count
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }

  // Get top expenses
  getTopExpenses(count: number): Expense[] {
    return [...this.getFilteredExpenses()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, count);
  }

  // Get recent spending trend
  getRecentSpendingTrend(): { trend: 'increasing' | 'decreasing' | 'stable'; percentage: number } {
    const recentExpenses = this.getRecentExpensesSorted().slice(0, 10);
    if (recentExpenses.length < 5) return { trend: 'stable', percentage: 0 };
    
    const midPoint = Math.floor(recentExpenses.length / 2);
    const firstHalf = recentExpenses.slice(0, midPoint);
    const secondHalf = recentExpenses.slice(midPoint);
    
    const firstHalfTotal = firstHalf.reduce((sum, e) => sum + e.amount, 0);
    const secondHalfTotal = secondHalf.reduce((sum, e) => sum + e.amount, 0);
    
    if (firstHalfTotal === 0) return { trend: 'stable', percentage: 0 };
    
    const percentage = ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100;
    
    if (percentage > 10) return { trend: 'increasing', percentage };
    if (percentage < -10) return { trend: 'decreasing', percentage };
    return { trend: 'stable', percentage };
  }

  // Export data functionality
  exportData(): void {
    const data = {
      expenses: this.expenses,
      categories: this.categories,
      analytics: this.getSpendingAnalytics(),
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-tracker-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Smart Recommendations
  getSmartRecommendations(): { title: string; description: string; priority: 'high' | 'medium' | 'low' }[] {
    const recommendations: { title: string; description: string; priority: 'high' | 'medium' | 'low' }[] = [];
    

    
    // Category concentration
    const topCategory = this.getTopSpendingCategory();
    if (topCategory && (topCategory.amount / this.getFilteredTotal()) > 0.6) {
      recommendations.push({
        title: 'Category Diversification',
        description: `Consider reducing spending in ${topCategory.name} category.`,
        priority: 'medium'
      });
    }
    
    // Large expenses
    const largeExpenses = this.expenses.filter(e => e.amount > 1000);
    if (largeExpenses.length > 3) {
      recommendations.push({
        title: 'Large Expenses Review',
        description: 'You have several large expenses. Consider if all are necessary.',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  // Enhanced filter with smart defaults
  getSmartFilters(): { label: string; value: string; description: string }[] {
    return [
      { label: 'All Time', value: 'all', description: 'Complete expense history' },
      { label: 'This Month', value: 'monthly', description: 'Current month expenses' },
      { label: 'This Year', value: 'yearly', description: 'Current year expenses' },
      { label: 'Last 30 Days', value: 'last30', description: 'Recent month activity' },
      { label: 'Last 7 Days', value: 'last7', description: 'This week\'s expenses' },
      { label: 'Specific Month/Year', value: 'monthOnly', description: 'Select specific month and year' },
      { label: 'Custom Range', value: 'custom', description: 'Select specific dates' }
    ];
  }

  // Quick summary cards data
  getQuickSummaryCards(): { title: string; value: string; change: string; trend: 'up' | 'down' | 'stable'; icon: string }[] {
    return [
      {
        title: 'Total Spent',
        value: `₹${this.getFilteredTotal().toLocaleString()}`,
        change: 'Current period',
        trend: 'stable',
        icon: '💰'
      },
      {
        title: 'Expense Count',
        value: this.getFilteredExpenses().length.toString(),
        change: `${this.getFilteredExpenses().length} this period`,
        trend: 'stable',
        icon: '📊'
      },
      {
        title: 'Average Per Expense',
        value: `₹${(this.getFilteredTotal() / Math.max(this.getFilteredExpenses().length, 1)).toFixed(0)}`,
        change: 'Per transaction',
        trend: 'stable',
        icon: '📈'
      },
      {
        title: 'Top Category',
        value: this.getTopSpendingCategory()?.name || 'No Data',
        change: this.getTopSpendingCategory() && this.getFilteredTotal() > 0 ? 
          `${((this.getTopSpendingCategory()!.amount / this.getFilteredTotal()) * 100).toFixed(1)}%` : 
          'No expenses',
        trend: 'stable',
        icon: '🏷️'
      }
    ];
  }

  // View category analytics (detailed breakdown)
  viewCategoryDetails(categoryId: string): void {
    // Get current filter state
    const filterState = this.filterStateService.getFilterState();
    
    // Navigate to expenses page with category filter and current filter state
    // This preserves all dashboard filters for detailed analysis
    this.router.navigate(['/expenses'], { 
      queryParams: { 
        category: categoryId,
        filter: 'category',
        period: filterState.selectedPeriod,
        month: filterState.selectedMonth,
        year: filterState.selectedYear,
        startDate: filterState.customStartDate,
        endDate: filterState.customEndDate,
        monthOnly: filterState.selectedMonthOnly,
        yearOnly: filterState.selectedYearOnly
      } 
    });
  }

  // Get maximum spending amount for chart scaling
  getMaxSpendingAmount(): number {
    const spendingByDay = this.getSpendingByDay();
    if (spendingByDay.length === 0) return 0;
    return Math.max(...spendingByDay.map(d => d.amount));
  }

  // Format date to day of week
  getDayOfWeek(date: string): string {
    return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
  }

  // Get maximum expense amount for a category
  getMaxExpenseForCategory(categoryId: string): number {
    const expenses = this.getExpensesByCategory(categoryId);
    if (expenses.length === 0) return 0;
    return Math.max(...expenses.map(e => e.amount));
  }

  // Get current month name for display
  getCurrentMonthName(): string {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long' });
  }

  // Get current year for display
  getCurrentYear(): string {
    const now = new Date();
    return now.getFullYear().toString();
  }

  // Get selected month name for display
  getSelectedMonthName(): string {
    const monthIndex = parseInt(this.selectedMonth);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex] || 'January';
  }

  // Get selected year for display
  getSelectedYear(): string {
    return this.selectedYear || new Date().getFullYear().toString();
  }

  // Available months for selection
  availableMonths: { value: string; label: string }[] = [
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' }
  ];

  // Available years for selection
  availableYears: string[] = [];

  // Get last week total
  getLastWeekTotal(): number {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return this.expenses
      .filter(expense => new Date(expense.date) >= oneWeekAgo)
      .reduce((total, expense) => total + expense.amount, 0);
  }

  // Get amount indicator
  getAmountIndicator(amount: number): string {
    if (amount > 5000) return 'high';
    if (amount > 1000) return 'medium';
    return 'low';
  }

  // Get category insights
  getCategoryInsights(categoryId: string): any[] {
    const insights = [];
    const expenses = this.getExpensesByCategory(categoryId);
    const total = this.categoryTotals[categoryId] || 0;
    const avg = expenses.length > 0 ? total / expenses.length : 0;
    
    if (total > this.getFilteredTotal() * 0.4) {
      insights.push({
        type: 'high',
        icon: '⚠️',
        text: 'High spending category'
      });
    }
    
    if (avg > 2000) {
      insights.push({
        type: 'medium',
        icon: '💰',
        text: 'High average expense'
      });
    }
    
    if (expenses.length > 10) {
      insights.push({
        type: 'low',
        icon: '📊',
        text: 'Frequent expenses'
      });
    }
    
    return insights;
  }

  // Get category trend
  getCategoryTrend(categoryId: string): any {
    // This is a simplified trend calculation
    // In a real app, you'd compare with previous periods
    const currentTotal = this.categoryTotals[categoryId] || 0;
    const avgTotal = this.getFilteredTotal() / Object.keys(this.categoryTotals).length;
    
    if (currentTotal > avgTotal * 1.2) {
      return {
        icon: '📈',
        text: 'Above average'
      };
    } else if (currentTotal < avgTotal * 0.8) {
      return {
        icon: '📉',
        text: 'Below average'
      };
    } else {
      return {
        icon: '➡️',
        text: 'Stable'
      };
    }
  }

  // Get expense insights
  getExpenseInsights(expense: Expense): any[] {
    const insights = [];
    
    if (expense.amount > 5000) {
      insights.push({
        type: 'high',
        icon: '💰',
        text: 'Large expense'
      });
    }
    
    if (expense.amount > this.getAverageExpense() * 2) {
      insights.push({
        type: 'medium',
        icon: '📊',
        text: 'Above average'
      });
    }
    
    const expenseDate = new Date(expense.date);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - expenseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) {
      insights.push({
        type: 'low',
        icon: '🆕',
        text: 'Recent'
      });
    }
    
    return insights;
  }

  // Get average expense
  getAverageExpense(): number {
    if (this.expenses.length === 0) return 0;
    return this.expenses.reduce((total, expense) => total + expense.amount, 0) / this.expenses.length;
  }





} 