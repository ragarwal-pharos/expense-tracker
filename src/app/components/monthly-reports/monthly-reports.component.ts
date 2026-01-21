import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { FirebaseService } from '../../core/services/firebase.service';
import { DialogService } from '../../core/services/dialog.service';
import { Subscription, combineLatest } from 'rxjs';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';

@Component({
  selector: 'app-monthly-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './monthly-reports.component.html',
  styleUrls: ['./monthly-reports.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthlyReportsComponent implements OnInit, OnDestroy {
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
  showAnalytics: boolean = true;
  
  // Toggle state for trend indicators - per report card
  trendDisplayModes: { [monthKey: string]: 'percentage' | 'amount' } = {};

  // View modes
  viewMode: 'grid' | 'list' = 'grid';

  // Expense sorting
  expenseSortBy: 'date' | 'amount' | 'category' = 'date';
  expenseSortOrder: 'asc' | 'desc' = 'desc';

  // Expense pagination
  currentExpensePage: number = 1;
  expensesPerPage: number = 10;

  // Analytics data
  totalSpent: number = 0;
  averageMonthlySpend: number = 0;
  highestSpendingMonth: any = null;
  mostUsedCategory: any = null;
  spendingTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';

  // Loading states
  isLoading: boolean = true;
  private subscription: Subscription = new Subscription();
  private categoryMap: Map<string, Category> = new Map();

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private firebaseService: FirebaseService,
    private dialogService: DialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Subscribe to Firebase observables for real-time updates using combineLatest for efficiency
    this.subscription.add(
      combineLatest([
        this.firebaseService.expenses$,
        this.firebaseService.categories$
      ]).subscribe(([expenses, categories]) => {
        this.expenses = expenses;
        this.categories = categories;
        
        // Build category map for O(1) lookups
        this.categoryMap.clear();
        this.categories.forEach(cat => this.categoryMap.set(cat.id, cat));
        
        // Generate monthly reports after loading data
        this.generateMonthlyReports();
        this.calculateAnalytics();
        
        this.cdr.markForCheck(); // Trigger change detection for OnPush
      })
    );

    // Subscribe to loading state
    this.subscription.add(
      this.firebaseService.loading$.subscribe(loading => {
        this.isLoading = loading;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
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
    
    this.totalSpent = filteredReports.reduce((sum, report) => sum + report.totalAmount, 0);
    this.averageMonthlySpend = filteredReports.length > 0 ? this.totalSpent / filteredReports.length : 0;
    
    // Find highest spending month
    this.highestSpendingMonth = filteredReports.reduce((max, report) => 
      report.totalAmount > max.totalAmount ? report : max, filteredReports[0]);
    
    // Calculate spending trend
    if (filteredReports.length >= 2) {
      const recent = filteredReports[0].totalAmount;
      const previous = filteredReports[1].totalAmount;
      const change = ((recent - previous) / previous) * 100;
      
      if (change > 10) this.spendingTrend = 'increasing';
      else if (change < -10) this.spendingTrend = 'decreasing';
      else this.spendingTrend = 'stable';
    }
  }

  // New methods for enhanced UI
  toggleAnalytics(): void {
    this.showAnalytics = !this.showAnalytics;
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  getAnalyticsPeriod(): string {
    const filteredReports = this.getFilteredReports();
    if (filteredReports.length === 0) return 'No data';
    
    const first = filteredReports[filteredReports.length - 1];
    const last = filteredReports[0];
    return `${first.monthName} - ${last.monthName}`;
  }

  getSpendingTrend(): any {
    const displayMode = this.trendDisplayModes['analytics'] || 'percentage';
    
    if (this.spendingTrend === 'increasing') {
      return { 
        icon: '📈', 
        text: 'Spending is increasing',
        description: 'Monthly expenses are trending upward',
        insight: 'Consider setting spending limits',
        severity: 'medium',
        isPositive: true,
        isNegative: false,
        isNeutral: false
      };
    } else if (this.spendingTrend === 'decreasing') {
      return { 
        icon: '📉', 
        text: 'Spending is decreasing',
        description: 'Monthly expenses are trending downward',
        insight: 'Excellent financial discipline!',
        severity: 'low',
        isPositive: false,
        isNegative: true,
        isNeutral: false
      };
    } else {
      return { 
        icon: '➡️', 
        text: 'Spending is stable',
        description: 'Monthly expenses are consistent',
        insight: 'Good spending control',
        severity: 'low',
        isPositive: false,
        isNegative: false,
        isNeutral: true
      };
    }
  }

  getTotalExpenses(): number {
    return this.expenses.length;
  }

  getTopCategory(): any {
    const categoryTotals: { [key: string]: number } = {};
    
    this.expenses.forEach(expense => {
      categoryTotals[expense.categoryId] = (categoryTotals[expense.categoryId] || 0) + expense.amount;
    });
    
    const topCategoryId = Object.keys(categoryTotals).reduce((a, b) => 
      categoryTotals[a] > categoryTotals[b] ? a : b);
    
    return this.categories.find(cat => cat.id === topCategoryId);
  }

  getTopCategoryPercentage(): number {
    const topCategory = this.getTopCategory();
    if (!topCategory || this.totalSpent === 0) return 0;
    
    const categoryTotal = this.expenses
      .filter(expense => expense.categoryId === topCategory.id)
      .reduce((sum, expense) => sum + expense.amount, 0);
    
    return Math.round((categoryTotal / this.totalSpent) * 100);
  }

  getReportTrend(report: any): any {
    const currentIndex = this.monthlyReports.findIndex(r => r.monthKey === report.monthKey);
    if (currentIndex === -1 || currentIndex === this.monthlyReports.length - 1) return null;
    
    const current = report.totalAmount;
    const previous = this.monthlyReports[currentIndex + 1].totalAmount;
    const change = ((current - previous) / previous) * 100;
    
    const amountChange = current - previous;
    const displayMode = this.trendDisplayModes[report.monthKey] || 'percentage';
    const displayText = displayMode === 'percentage' 
      ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
      : `${amountChange > 0 ? '+' : ''}₹${Math.abs(amountChange).toLocaleString()}`;
    

    if (change > 50) {
      return { 
        icon: '🚨', 
        text: displayText,
        description: 'Significantly higher spending',
        insight: 'Consider reviewing your budget',
        severity: 'high',
        isPositive: true,
        isNegative: false,
        isNeutral: false
      };
    } else if (change > 10) {
      return { 
        icon: '📈', 
        text: displayText,
        description: 'Higher spending than last month',
        insight: 'Monitor your expenses closely',
        severity: 'medium',
        isPositive: true,
        isNegative: false,
        isNeutral: false
      };
    } else if (change < -50) {
      return { 
        icon: '🎉', 
        text: displayText,
        description: 'Significantly lower spending',
        insight: 'Great job managing your budget!',
        severity: 'high',
        isPositive: false,
        isNegative: true,
        isNeutral: false
      };
    } else if (change < -10) {
      return { 
        icon: '📉', 
        text: displayText,
        description: 'Lower spending than last month',
        insight: 'Good progress on savings',
        severity: 'medium',
        isPositive: false,
        isNegative: true,
        isNeutral: false
      };
    } else {
      const displayMode = this.trendDisplayModes[report.monthKey] || 'percentage';
      return { 
        icon: '➡️', 
        text: displayMode === 'percentage' ? '±0%' : '₹0',
        description: 'Similar spending to last month',
        insight: 'Consistent spending pattern',
        severity: 'low',
        isPositive: false,
        isNegative: false,
        isNeutral: true
      };
    }
  }

  getTopCategoryForReport(report: any): any {
    if (!report.categoryBreakdown || report.categoryBreakdown.length === 0) return null;
    return report.categoryBreakdown[0].category;
  }

  getAverageExpenseAmount(): number {
    const filteredCount = this.getFilteredExpenseCount();
    const filteredTotal = this.getFilteredTotalAmount();
    if (filteredCount === 0) return 0;
    return filteredTotal / filteredCount;
  }

  getCategoryPercentage(breakdown: any): number {
    const filteredTotal = this.getFilteredTotalAmount();
    if (filteredTotal === 0) return 0;
    return Math.round((breakdown.amount / filteredTotal) * 100);
  }

  // Get filtered category breakdown for detailed view
  getFilteredCategoryBreakdown(): any[] {
    const selectedReport = this.getSelectedMonthReport();
    if (!selectedReport) return [];

    let categoryBreakdown = selectedReport.categoryBreakdown;

    // If category filter is applied, show only that category
    if (this.filterCategory) {
      categoryBreakdown = categoryBreakdown.filter((breakdown: any) => 
        breakdown.category.id === this.filterCategory
      );
    }

    return categoryBreakdown;
  }

  // Get filtered total amount for detailed view
  getFilteredTotalAmount(): number {
    const selectedReport = this.getSelectedMonthReport();
    if (!selectedReport) return 0;

    if (!this.filterCategory) {
      return selectedReport.totalAmount;
    }

    // Calculate total for filtered category only
    const filteredBreakdown = this.getFilteredCategoryBreakdown();
    return filteredBreakdown.reduce((total, breakdown) => total + breakdown.amount, 0);
  }

  // Get filtered expense count for detailed view
  getFilteredExpenseCount(): number {
    const selectedReport = this.getSelectedMonthReport();
    if (!selectedReport) return 0;

    if (!this.filterCategory) {
      return selectedReport.expenseCount;
    }

    // Count expenses for filtered category only
    return selectedReport.expenses.filter((expense: Expense) => 
      expense.categoryId === this.filterCategory
    ).length;
  }

  toggleExpenseSort(): void {
    if (this.expenseSortBy === 'date') {
      this.expenseSortBy = 'amount';
    } else if (this.expenseSortBy === 'amount') {
      this.expenseSortBy = 'category';
    } else {
      this.expenseSortBy = 'date';
    }
    // Reset to first page when sorting changes
    this.currentExpensePage = 1;
  }

  getSortIcon(): string {
    switch (this.expenseSortBy) {
      case 'date': return '📅';
      case 'amount': return '💰';
      case 'category': return '🏷️';
      default: return '📅';
    }
  }

  getSortLabel(): string {
    switch (this.expenseSortBy) {
      case 'date': return 'Sort by Date';
      case 'amount': return 'Sort by Amount';
      case 'category': return 'Sort by Category';
      default: return 'Sort by Date';
    }
  }

  getSortedExpenses(): Expense[] {
    const selectedReport = this.getSelectedMonthReport();
    if (!selectedReport) return [];
    
    let expenses = [...selectedReport.expenses];
    
    // Apply category filter if active
    if (this.filterCategory) {
      expenses = expenses.filter(expense => expense.categoryId === this.filterCategory);
    }
    
    expenses.sort((a, b) => {
      let comparison = 0;
      
      switch (this.expenseSortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'category':
          const categoryA = this.getCategoryName(a.categoryId);
          const categoryB = this.getCategoryName(b.categoryId);
          comparison = categoryA.localeCompare(categoryB);
          break;
      }
      
      return this.expenseSortOrder === 'asc' ? comparison : -comparison;
    });
    
    return expenses;
  }

  getAmountIndicator(amount: number): string {
    if (amount > 5000) return 'high';
    if (amount > 1000) return 'medium';
    return 'low';
  }

  exportReport(): void {
    const selectedReport = this.getSelectedMonthReport();
    if (!selectedReport) {
      this.exportFullReport();
      return;
    }
    this.exportMonthReport();
  }

  async exportFullReport(): Promise<void> {
    const filteredReports = this.getFilteredReports();
    if (filteredReports.length === 0) {
      await this.dialogService.warning('No data to export. Please adjust your filters.');
      return;
    }

    const now = new Date();
    const timestamp = now.getFullYear() + '-' + 
                     String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(now.getDate()).padStart(2, '0');
    const filename = `expense_report_${timestamp}.csv`;
    
    let csvContent = this.generateFullReportCSV(filteredReports);
    await this.downloadCSV(csvContent, filename);
  }

  async exportMonthReport(): Promise<void> {
    const selectedReport = this.getSelectedMonthReport();
    if (!selectedReport) {
      await this.dialogService.warning('No month selected for export.');
      return;
    }

    const now = new Date();
    const timestamp = now.getFullYear() + '-' + 
                     String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(now.getDate()).padStart(2, '0');
    const filename = `expense_report_${selectedReport.monthName.replace(' ', '_')}_${timestamp}.csv`;
    
    let csvContent = this.generateMonthReportCSV(selectedReport);
    await this.downloadCSV(csvContent, filename);
  }

  private generateFullReportCSV(reports: any[]): string {
    let csv = '';
    
    // Header with proper formatting
    csv += 'Expense Tracker - Full Report\n';
    csv += `Generated on: ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}\n`;
    csv += `Report Period: ${reports.length > 0 ? `${reports[reports.length - 1]?.monthName} to ${reports[0]?.monthName}` : 'N/A'}\n`;
    csv += '\n';
    
    // Summary section with better formatting
    csv += 'SUMMARY OVERVIEW\n';
    csv += '='.repeat(50) + '\n';
    
    const totalSpent = reports.reduce((sum, report) => sum + report.totalAmount, 0);
    const totalExpenses = reports.reduce((sum, report) => sum + report.expenseCount, 0);
    const avgMonthly = reports.length > 0 ? totalSpent / reports.length : 0;
    
    csv += `Total Amount Spent: ₹${totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    csv += `Total Number of Expenses: ${totalExpenses.toLocaleString('en-IN')}\n`;
    csv += `Average Monthly Spending: ₹${avgMonthly.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    csv += `Number of Months: ${reports.length}\n`;
    csv += '\n';
    
    // Monthly breakdown with better formatting
    csv += 'MONTHLY BREAKDOWN\n';
    csv += '='.repeat(50) + '\n';
    csv += 'Month,Total Amount (₹),Expense Count,Top Category,Top Category Amount (₹),Top Category %\n';
    
    reports.forEach(report => {
      const topCategory = this.getTopCategoryForReport(report);
      const topCategoryAmount = topCategory ? this.getCategoryAmountForReport(report, topCategory.id) : '0.00';
      const topCategoryPercentage = topCategory && report.totalAmount > 0 ? 
        ((parseFloat(topCategoryAmount) / report.totalAmount) * 100).toFixed(1) : '0.0';
      
      csv += `"${report.monthName}","${report.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}","${report.expenseCount}","${topCategory?.name || 'N/A'}","${topCategoryAmount}","${topCategoryPercentage}%"\n`;
    });
    
    csv += '\n';
    
    // Category summary across all months with better formatting
    csv += 'CATEGORY SUMMARY (All Months)\n';
    csv += '='.repeat(50) + '\n';
    csv += 'Category,Total Amount (₹),Total Count,Percentage of Total,Average per Expense (₹)\n';
    
    const categorySummary = this.getCategorySummaryAcrossMonths(reports);
    categorySummary.forEach(cat => {
      const percentage = totalSpent > 0 ? ((cat.amount / totalSpent) * 100).toFixed(1) : '0.0';
      const avgPerExpense = cat.count > 0 ? (cat.amount / cat.count) : 0;
      
      csv += `"${cat.name}","${cat.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}","${cat.count}","${percentage}%","${avgPerExpense.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"\n`;
    });
    
    csv += '\n';
    
    // Additional insights
    csv += 'ADDITIONAL INSIGHTS\n';
    csv += '='.repeat(50) + '\n';
    
    if (reports.length > 0) {
      const highestMonth = reports.reduce((max, report) => 
        report.totalAmount > max.totalAmount ? report : max, reports[0]);
      const lowestMonth = reports.reduce((min, report) => 
        report.totalAmount < min.totalAmount ? report : min, reports[0]);
      
      csv += `Highest Spending Month: ${highestMonth.monthName} (₹${highestMonth.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})\n`;
      csv += `Lowest Spending Month: ${lowestMonth.monthName} (₹${lowestMonth.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})\n`;
      
      if (reports.length >= 2) {
        const recent = reports[0].totalAmount;
        const previous = reports[1].totalAmount;
        const change = ((recent - previous) / previous) * 100;
        csv += `Recent Trend: ${change > 0 ? 'Increase' : change < 0 ? 'Decrease' : 'Stable'} (${change.toFixed(1)}%)\n`;
      }
    }
    
    return csv;
  }

  private generateMonthReportCSV(report: any): string {
    let csv = '';
    
    // Header with proper formatting
    csv += 'Expense Tracker - Monthly Report\n';
    csv += `Generated on: ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}\n`;
    csv += '\n';
    
    // Report summary with better formatting
    csv += 'MONTHLY SUMMARY\n';
    csv += '='.repeat(50) + '\n';
    csv += `Report Period: ${report.monthName}\n`;
    csv += `Total Amount Spent: ₹${report.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    csv += `Total Number of Expenses: ${report.expenseCount.toLocaleString('en-IN')}\n`;
    csv += `Average Amount per Expense: ₹${(report.expenseCount > 0 ? (report.totalAmount / report.expenseCount) : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    csv += `Number of Categories Used: ${report.categoryBreakdown.length}\n`;
    csv += '\n';
    
    // Category breakdown with better formatting
    csv += 'CATEGORY BREAKDOWN\n';
    csv += '='.repeat(50) + '\n';
    csv += 'Category,Amount (₹),Number of Expenses,Percentage of Total,Average per Expense (₹)\n';
    
    report.categoryBreakdown.forEach((breakdown: any) => {
      const percentage = ((breakdown.amount / report.totalAmount) * 100).toFixed(1);
      const avgPerExpense = breakdown.count > 0 ? (breakdown.amount / breakdown.count) : 0;
      
      csv += `"${breakdown.category.name}","${breakdown.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}","${breakdown.count}","${percentage}%","${avgPerExpense.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"\n`;
    });
    
    csv += '\n';
    
    // Individual expenses with better formatting
    csv += 'INDIVIDUAL EXPENSES\n';
    csv += '='.repeat(50) + '\n';
    csv += 'Date,Description,Category,Amount (₹),Priority,Amount Category\n';
    
    const sortedExpenses = [...report.expenses].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    sortedExpenses.forEach(expense => {
      const category = this.getCategoryName(expense.categoryId);
      const date = new Date(expense.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      const priority = expense.priority || 'Normal';
      const amountCategory = this.getAmountCategory(expense.amount);
      
      csv += `"${date}","${expense.description || 'No description'}","${category}","${expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}","${priority}","${amountCategory}"\n`;
    });
    
    csv += '\n';
    
    // Additional insights for the month
    csv += 'MONTHLY INSIGHTS\n';
    csv += '='.repeat(50) + '\n';
    
    if (report.categoryBreakdown.length > 0) {
      const topCategory = report.categoryBreakdown[0];
      const bottomCategory = report.categoryBreakdown[report.categoryBreakdown.length - 1];
      
      csv += `Top Spending Category: ${topCategory.category.name} (₹${topCategory.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - ${((topCategory.amount / report.totalAmount) * 100).toFixed(1)}%)\n`;
      csv += `Lowest Spending Category: ${bottomCategory.category.name} (₹${bottomCategory.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - ${((bottomCategory.amount / report.totalAmount) * 100).toFixed(1)}%)\n`;
    }
    
    const highValueExpenses = sortedExpenses.filter(exp => exp.amount > 1000);
    const lowValueExpenses = sortedExpenses.filter(exp => exp.amount <= 500);
    
    csv += `High Value Expenses (>₹1,000): ${highValueExpenses.length}\n`;
    csv += `Low Value Expenses (≤₹500): ${lowValueExpenses.length}\n`;
    csv += `Medium Value Expenses (₹500-₹1,000): ${sortedExpenses.length - highValueExpenses.length - lowValueExpenses.length}\n`;
    
    return csv;
  }

  private getAmountCategory(amount: number): string {
    if (amount > 5000) return 'Very High';
    if (amount > 2000) return 'High';
    if (amount > 1000) return 'Medium-High';
    if (amount > 500) return 'Medium';
    if (amount > 200) return 'Low-Medium';
    return 'Low';
  }

  private getCategorySummaryAcrossMonths(reports: any[]): any[] {
    const categoryTotals: { [key: string]: { amount: number, count: number, name: string } } = {};
    
    reports.forEach(report => {
      report.categoryBreakdown.forEach((breakdown: any) => {
        const categoryId = breakdown.category.id;
        if (!categoryTotals[categoryId]) {
          categoryTotals[categoryId] = { amount: 0, count: 0, name: breakdown.category.name };
        }
        categoryTotals[categoryId].amount += breakdown.amount;
        categoryTotals[categoryId].count += breakdown.count;
      });
    });
    
    return Object.values(categoryTotals)
      .sort((a, b) => b.amount - a.amount);
  }

  private getCategoryAmountForReport(report: any, categoryId: string): string {
    const breakdown = report.categoryBreakdown.find((b: any) => b.category.id === categoryId);
    return breakdown ? breakdown.amount.toFixed(2) : '0.00';
  }

  private async downloadCSV(content: string, filename: string): Promise<void> {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Fallback for older browsers
      await this.dialogService.warning('Download not supported in this browser. Copy the data manually.');
    }
  }

  // Filter checking method
  hasActiveFilters(): boolean {
    return !!(this.filterYear || this.filterMonth || this.filterCategory);
  }

  // Pagination methods for expenses
  getPaginatedExpenses(): Expense[] {
    const sortedExpenses = this.getSortedExpenses();
    const startIndex = this.getExpenseStartIndex();
    const endIndex = this.getExpenseEndIndex();
    return sortedExpenses.slice(startIndex, endIndex);
  }

  getTotalExpensePages(): number {
    const totalExpenses = this.getSortedExpenses().length;
    return Math.ceil(totalExpenses / this.expensesPerPage);
  }

  getExpenseStartIndex(): number {
    return (this.currentExpensePage - 1) * this.expensesPerPage;
  }

  getExpenseEndIndex(): number {
    const startIndex = this.getExpenseStartIndex();
    const totalExpenses = this.getSortedExpenses().length;
    return Math.min(startIndex + this.expensesPerPage, totalExpenses);
  }

  getExpensePageNumbers(): number[] {
    const totalPages = this.getTotalExpensePages();
    const currentPage = this.currentExpensePage;
    const pages: number[] = [];
    
    // Show up to 5 page numbers around current page
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  goToExpensePage(page: number): void {
    if (page >= 1 && page <= this.getTotalExpensePages()) {
      this.currentExpensePage = page;
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
    // Reset detailed view if category filter is applied and no data exists for selected month
    if (this.showDetailedView && this.filterCategory) {
      const selectedReport = this.getSelectedMonthReport();
      if (selectedReport) {
        const hasExpensesForCategory = selectedReport.expenses.some((expense: Expense) => 
          expense.categoryId === this.filterCategory
        );
        if (!hasExpensesForCategory) {
          // Hide detailed view if no expenses exist for the selected category
          this.showDetailedView = false;
        }
      }
    }
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
    
    let status = 'No significant change';
    if (change > 0) status = 'Higher spending this month';
    else if (change < 0) status = 'Lower spending this month';
    
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

  // Check if detailed view should be shown based on current filters
  shouldShowDetailedView(): boolean {
    if (!this.showDetailedView || !this.selectedMonth) {
      return false;
    }

    const selectedReport = this.getSelectedMonthReport();
    if (!selectedReport) {
      return false;
    }

    // If no category filter is applied, show the detailed view
    if (!this.filterCategory) {
      return true;
    }

    // If category filter is applied, check if there are expenses for that category in the selected month
    const hasExpensesForCategory = selectedReport.expenses.some((expense: Expense) => 
      expense.categoryId === this.filterCategory
    );

    return hasExpensesForCategory;
  }

  getCategoryName(categoryId: string): string {
    const category = this.categoryMap.get(categoryId); // Use Map for O(1) lookup
    return category ? category.name : 'Unknown';
  }

  getCategoryIcon(categoryId: string): string {
    const category = this.categoryMap.get(categoryId); // Use Map for O(1) lookup
    return category && category.icon ? category.icon : '📌';
  }

  getCategoryColor(categoryId: string): string {
    const category = this.categoryMap.get(categoryId); // Use Map for O(1) lookup
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

  toggleTrendDisplayMode(event?: Event, monthKey?: string): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    
    if (monthKey) {
      // Toggle for specific report card
      const currentMode = this.trendDisplayModes[monthKey] || 'percentage';
      this.trendDisplayModes[monthKey] = currentMode === 'percentage' ? 'amount' : 'percentage';
    } else {
      // Fallback for analytics section (global toggle)
      const globalMode = this.trendDisplayModes['analytics'] || 'percentage';
      this.trendDisplayModes['analytics'] = globalMode === 'percentage' ? 'amount' : 'percentage';
    }
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

  // Method to show category expenses using the dialog
  async showCategoryExpenses(category: Category): Promise<void> {
    const selectedReport = this.getSelectedMonthReport();
    if (!selectedReport) {
      await this.dialogService.warning('No month selected. Please select a month first.');
      return;
    }

    // Get expenses for this category in the selected month
    const categoryExpenses = selectedReport.expenses.filter((expense: Expense) => 
      expense.categoryId === category.id
    );

    // Prepare expenses data for the dialog
    const expensesData = categoryExpenses.map((expense: Expense) => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      categoryId: expense.categoryId
    }));

    // Show the expense list in the dialog
    await this.dialogService.showExpenseList(
      expensesData,
      category.name,
      category.icon,
      category.color
    );
  }


} 