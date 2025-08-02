import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { Subscription } from 'rxjs';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';

@Component({
  selector: 'app-monthly-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './monthly-reports.component.html',
  styleUrls: ['./monthly-reports.component.scss']
})
export class MonthlyReportsComponent implements OnInit {
  expenses: Expense[] = [];
  categories: Category[] = [];
  monthlyReports: any[] = [];
  selectedMonth: string = '';
  showDetailedView: boolean = false;

  // Enhanced filtering and sorting
  filterYear: string = '';
  filterMonth: string = '';
  filterCategory: string = '';
  sortBy: 'month' | 'amount' | 'expenseCount' = 'month';
  sortOrder: 'asc' | 'desc' = 'desc';
  showAnalytics: boolean = false;

  // Analytics data
  totalSpent: number = 0;
  averageMonthlySpend: number = 0;
  highestSpendingMonth: any = null;
  mostUsedCategory: any = null;
  spendingTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    try {
      this.expenses = await this.expenseService.getAll();
      this.categories = await this.categoryService.getAll();
      
      // Generate monthly reports after loading data
      this.generateMonthlyReports();
      this.calculateAnalytics();
      
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  }

  generateMonthlyReports() {
    const monthlyExpenses: { [key: string]: Expense[] } = {};
    
    this.expenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyExpenses[monthKey]) {
        monthlyExpenses[monthKey] = [];
      }
      monthlyExpenses[monthKey].push(expense);
    });
    
    this.monthlyReports = [];
    Object.keys(monthlyExpenses).sort().reverse().forEach(monthKey => {
      const expenses = monthlyExpenses[monthKey];
      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const categoryBreakdown = this.getCategoryBreakdown(expenses);
      
      const [year, month] = monthKey.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      this.monthlyReports.push({
        monthKey,
        monthName,
        totalAmount,
        expenseCount: expenses.length,
        categoryBreakdown,
        expenses,
        year: parseInt(year),
        month: parseInt(month)
      });
    });
  }

  calculateAnalytics() {
    if (this.monthlyReports.length === 0) return;

    // Get filtered reports for analytics calculation
    const filteredReports = this.getFilteredReports();
    
    if (filteredReports.length === 0) {
      // Reset analytics if no filtered data
      this.totalSpent = 0;
      this.averageMonthlySpend = 0;
      this.highestSpendingMonth = null;
      this.mostUsedCategory = null;
      this.spendingTrend = 'stable';
      return;
    }

    // Total spent (based on filtered data)
    this.totalSpent = filteredReports.reduce((sum, report) => sum + report.totalAmount, 0);
    
    // Average monthly spend (based on filtered data)
    this.averageMonthlySpend = this.totalSpent / filteredReports.length;
    
    // Highest spending month (based on filtered data)
    this.highestSpendingMonth = filteredReports.reduce((max, report) => 
      report.totalAmount > max.totalAmount ? report : max
    );
    
    // Most used category (based on filtered data)
    const categoryUsage: { [key: string]: number } = {};
    
    // Get expenses for the filtered time period
    const filteredExpenses = this.getFilteredExpenses();
    filteredExpenses.forEach(expense => {
      categoryUsage[expense.categoryId] = (categoryUsage[expense.categoryId] || 0) + 1;
    });
    
    if (Object.keys(categoryUsage).length > 0) {
      const mostUsedCategoryId = Object.keys(categoryUsage).reduce((max, key) => 
        categoryUsage[key] > categoryUsage[max] ? key : max
      );
      this.mostUsedCategory = this.categories.find(cat => cat.id === mostUsedCategoryId);
    } else {
      this.mostUsedCategory = null;
    }
    
    // Spending trend (based on filtered data)
    if (filteredReports.length >= 2) {
      const recent = filteredReports[0].totalAmount;
      const previous = filteredReports[1].totalAmount;
      const change = recent - previous;
      
      if (change > 0) this.spendingTrend = 'increasing';
      else if (change < 0) this.spendingTrend = 'decreasing';
      else this.spendingTrend = 'stable';
    } else {
      this.spendingTrend = 'stable';
    }
  }

  getFilteredReports(): any[] {
    let filtered = [...this.monthlyReports];
    
    // Filter by year
    if (this.filterYear) {
      filtered = filtered.filter(report => report.year.toString() === this.filterYear);
    }
    
    // Filter by month
    if (this.filterMonth) {
      filtered = filtered.filter(report => report.month.toString() === this.filterMonth);
    }
    
    // Filter by category
    if (this.filterCategory) {
      filtered = filtered.filter(report => 
        report.categoryBreakdown.some((breakdown: any) => 
          breakdown.category.id === this.filterCategory
        )
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (this.sortBy) {
        case 'month':
          aValue = new Date(a.year, a.month - 1).getTime();
          bValue = new Date(b.year, b.month - 1).getTime();
          break;
        case 'amount':
          aValue = a.totalAmount;
          bValue = b.totalAmount;
          break;
        case 'expenseCount':
          aValue = a.expenseCount;
          bValue = b.expenseCount;
          break;
        default:
          aValue = new Date(a.year, a.month - 1).getTime();
          bValue = new Date(b.year, b.month - 1).getTime();
      }
      
      return this.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
    
    return filtered;
  }

  getAvailableYears(): string[] {
    const years = [...new Set(this.monthlyReports.map(report => report.year.toString()))];
    return years.sort((a, b) => parseInt(b) - parseInt(a));
  }

  getAvailableMonths(): string[] {
    const months = [...new Set(this.monthlyReports.map(report => report.month.toString()))];
    return months.sort((a, b) => parseInt(a) - parseInt(b));
  }

  getMonthName(monthNumber: string): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[parseInt(monthNumber) - 1] || monthNumber;
  }

  clearFilters() {
    this.filterYear = '';
    this.filterMonth = '';
    this.filterCategory = '';
    this.sortBy = 'month';
    this.sortOrder = 'desc';
    this.calculateAnalytics(); // Recalculate analytics when filters are cleared
  }

  // Method to recalculate analytics when filters change
  onFilterChange() {
    this.calculateAnalytics();
  }

  getCategoryBreakdown(expenses: Expense[]): any[] {
    const breakdown: { [key: string]: { amount: number, count: number, category: Category } } = {};
    
    expenses.forEach(expense => {
      const category = this.categories.find(cat => cat.id === expense.categoryId);
      if (category) {
        if (!breakdown[category.id]) {
          breakdown[category.id] = { amount: 0, count: 0, category };
        }
        breakdown[category.id].amount += expense.amount;
        breakdown[category.id].count += 1;
      }
    });
    
    return Object.values(breakdown).sort((a, b) => b.amount - a.amount);
  }

  getCurrentMonthReport() {
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    return this.monthlyReports.find(report => report.monthKey === currentMonthKey);
  }

  getPreviousMonthReport() {
    const currentDate = new Date();
    const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
    const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
    return this.monthlyReports.find(report => report.monthKey === previousMonthKey);
  }

  getMonthlyComparison() {
    const current = this.getCurrentMonthReport();
    const previous = this.getPreviousMonthReport();
    
    if (!current || !previous) {
      return {
        change: 0,
        percentage: 0,
        hasPreviousData: false,
        status: current ? 'First Month' : 'No Data'
      };
    }
    
    const change = current.totalAmount - previous.totalAmount;
    const percentage = previous.totalAmount > 0 ? (change / previous.totalAmount) * 100 : 0;
    
    let status = 'No Change';
    if (change > 0) status = 'Increased';
    else if (change < 0) status = 'Decreased';
    
    return {
      change,
      percentage: parseFloat(percentage.toFixed(2)),
      hasPreviousData: true,
      status
    };
  }

  selectMonth(monthKey: string) {
    this.selectedMonth = monthKey;
    this.showDetailedView = true;
  }

  getSelectedMonthReport() {
    return this.monthlyReports.find(report => report.monthKey === this.selectedMonth);
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown';
  }

  getCategoryIcon(categoryId: string): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category && category.icon ? category.icon : '📌';
  }

  getCategoryColor(categoryId: string): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category && category.color ? category.color : '#6c757d';
  }

  getSpendingInsights(): any[] {
    const insights = [];
    
    if (this.highestSpendingMonth) {
      insights.push({
        type: 'highest',
        title: 'Highest Spending Month',
        value: this.highestSpendingMonth.monthName,
        amount: this.highestSpendingMonth.totalAmount,
        icon: '📈'
      });
    }
    
    if (this.mostUsedCategory) {
      insights.push({
        type: 'category',
        title: 'Most Used Category',
        value: this.mostUsedCategory.name,
        icon: this.mostUsedCategory.icon || '📌'
      });
    }
    
    insights.push({
      type: 'trend',
      title: 'Spending Trend',
      value: this.spendingTrend.charAt(0).toUpperCase() + this.spendingTrend.slice(1),
      icon: this.spendingTrend === 'increasing' ? '📈' : this.spendingTrend === 'decreasing' ? '📉' : '➡️'
    });
    
    return insights;
  }

  getFilteredExpenses(): Expense[] {
    let filtered = [...this.expenses];
    
    // Filter by year
    if (this.filterYear) {
      filtered = filtered.filter(expense => {
        const expenseYear = new Date(expense.date).getFullYear().toString();
        return expenseYear === this.filterYear;
      });
    }
    
    // Filter by month
    if (this.filterMonth) {
      filtered = filtered.filter(expense => {
        const expenseMonth = (new Date(expense.date).getMonth() + 1).toString();
        return expenseMonth === this.filterMonth;
      });
    }
    
    // Filter by category
    if (this.filterCategory) {
      filtered = filtered.filter(expense => expense.categoryId === this.filterCategory);
    }
    
    return filtered;
  }
} 