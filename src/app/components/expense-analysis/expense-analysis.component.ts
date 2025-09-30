import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { DialogService } from '../../core/services/dialog.service';
import { ChartService, TrendData, PieData, BarData } from '../../core/services/chart.service';
import { ChartConfigService } from '../../core/services/chart-config.service';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';
import { LoadingComponent } from '../../shared/components/loading/loading.component';

interface CategoryAnalysis {
  category: Category;
  totalAmount: number;
  percentage: number;
  expenseCount: number;
  averageAmount: number;
  monthlyBreakdown: MonthlyData[];
}

interface MonthlyData {
  month: string;
  year: number;
  amount: number;
  expenseCount: number;
  percentage: number;
}


@Component({
  selector: 'app-expense-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LoadingComponent, BaseChartDirective],
  templateUrl: './expense-analysis.component.html',
  styleUrls: ['./expense-analysis.component.scss']
})
export class ExpenseAnalysisComponent implements OnInit, OnDestroy {
  expenses: Expense[] = [];
  categories: Category[] = [];
  categoryAnalysis: CategoryAnalysis[] = [];
  isLoading = true;
  
  // Filter options
  selectedStartDate = '';
  selectedEndDate = '';
  selectedCategories: string[] = [];
  isCategoryDropdownOpen = false;
  dropdownAlignment = 'left';
  
  // Enhanced filtering options
  searchQuery = '';
  minAmount = '';
  maxAmount = '';
  selectedDatePreset = '';
  comparisonMode = false;
  selectedCategoriesForComparison: string[] = [];
  
  // Available options
  availableCategories: Category[] = [];
  usedCategories: Category[] = [];
  
  // Analysis data
  totalExpenses = 0;
  totalExpenseCount = 0;
  averageExpenseAmount = 0;
  
  // Chart data
  trendData: TrendData | null = null;
  pieData: PieData | null = null;
  barData: BarData | null = null;
  showCharts = false;
  
  
  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private dialogService: DialogService,
    private chartService: ChartService,
    private chartConfigService: ChartConfigService
  ) {}

  async ngOnInit() {
    await this.loadData();
    this.initializeFilters();
    this.performAnalysis();
    this.isLoading = false;
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.multiselect-container')) {
      this.isCategoryDropdownOpen = false;
    }
  }

  async loadData() {
    try {
      this.expenses = await this.expenseService.getAll();
      this.categories = await this.categoryService.getAll();
      
      // Log detailed information about orphaned expenses
      this.logOrphanedExpensesDetails();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  initializeFilters() {
    // Set default date range to show all data (no date filtering by default)
    // This matches the behavior of the reports component
    this.selectedStartDate = '';
    this.selectedEndDate = '';
    this.selectedDatePreset = 'all'; // Set "All Time" as default selected filter

    // Initialize categories
    this.availableCategories = this.categories;
    this.updateUsedCategories();
  }

  getFilteredExpenses(): Expense[] {
    return this.expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      const expenseDateString = expenseDate.toISOString().split('T')[0];
      
      // Date range filtering
      const startDateMatch = !this.selectedStartDate || expenseDateString >= this.selectedStartDate;
      const endDateMatch = !this.selectedEndDate || expenseDateString <= this.selectedEndDate;
      
      // Category filtering (multiple categories)
      const categoryMatch = this.selectedCategories.length === 0 || this.selectedCategories.includes(expense.categoryId);
      
      // Smart search filtering
      const searchMatch = !this.searchQuery || 
        expense.description?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        expense.notes?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        expense.amount.toString().includes(this.searchQuery) ||
        expense.location?.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      // Amount range filtering
      const minAmountMatch = !this.minAmount || expense.amount >= parseFloat(this.minAmount);
      const maxAmountMatch = !this.maxAmount || expense.amount <= parseFloat(this.maxAmount);
      
      return startDateMatch && endDateMatch && categoryMatch && searchMatch && minAmountMatch && maxAmountMatch;
    });
  }

  performAnalysis() {
    const filteredExpenses = this.getFilteredExpenses();
    
    // Calculate totals
    this.totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    this.totalExpenseCount = filteredExpenses.length;
    this.averageExpenseAmount = this.totalExpenseCount > 0 ? this.totalExpenses / this.totalExpenseCount : 0;
    
    // Group expenses by category
    const categoryMap = new Map<string, Expense[]>();
    filteredExpenses.forEach(expense => {
      if (!categoryMap.has(expense.categoryId)) {
        categoryMap.set(expense.categoryId, []);
      }
      categoryMap.get(expense.categoryId)!.push(expense);
    });
    
    // Create category analysis
    this.categoryAnalysis = Array.from(categoryMap.entries()).map(([categoryId, expenses]) => {
      const category = this.categories.find(c => c.id === categoryId);
      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const percentage = this.totalExpenses > 0 ? (totalAmount / this.totalExpenses) * 100 : 0;
      const averageAmount = expenses.length > 0 ? totalAmount / expenses.length : 0;
      
      // Calculate monthly breakdown
      const monthlyBreakdown = this.calculateMonthlyBreakdown(expenses);
      
      // Handle missing categories with better fallback
      const categoryInfo = category || { 
        id: categoryId, 
        name: 'Orphaned Category', 
        color: '#95A5A6', 
        icon: '❓' 
      };
      
      return {
        category: categoryInfo,
        totalAmount,
        percentage,
        expenseCount: expenses.length,
        averageAmount,
        monthlyBreakdown
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  calculateMonthlyBreakdown(expenses: Expense[]): MonthlyData[] {
    const monthlyMap = new Map<string, { amount: number; count: number }>();
    
    expenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { amount: 0, count: 0 });
      }
      
      const data = monthlyMap.get(monthKey)!;
      data.amount += expense.amount;
      data.count += 1;
    });
    
    // Calculate total amount for this specific category across all months
    const categoryTotalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    return Array.from(monthlyMap.entries()).map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-');
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      
      const monthName = monthNames[parseInt(month) - 1];
      
      return {
        month: monthName,
        year: parseInt(year),
        amount: data.amount,
        expenseCount: data.count,
        percentage: categoryTotalAmount > 0 ? (data.amount / categoryTotalAmount) * 100 : 0
      };
    }).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.amount - a.amount;
    });
  }

  onFilterChange() {
    this.updateUsedCategories();
    this.performAnalysis();
    if (this.showCharts) {
      this.generateChartData();
    }
  }

  // Helper method to format dates for input fields (timezone-safe)
  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Date preset functionality
  applyDatePreset(preset: string) {
    const today = new Date();
    this.selectedDatePreset = preset;
    
    switch (preset) {
      case 'thisMonth':
        // Get the first day of current month
        const year = today.getFullYear();
        const month = today.getMonth();
        const thisMonthStart = new Date(year, month, 1);
        // Get the last day of current month
        const thisMonthEnd = new Date(year, month + 1, 0);
        
        // Format dates to avoid timezone issues
        this.selectedStartDate = this.formatDateForInput(thisMonthStart);
        this.selectedEndDate = this.formatDateForInput(thisMonthEnd);
        break;
      case 'last30':
        const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        this.selectedStartDate = this.formatDateForInput(last30Days);
        this.selectedEndDate = this.formatDateForInput(today);
        break;
      case 'thisQuarter':
        const currentQuarter = Math.floor(today.getMonth() / 3);
        const quarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1);
        const quarterEnd = new Date(today.getFullYear(), currentQuarter * 3 + 3, 0);
        this.selectedStartDate = this.formatDateForInput(quarterStart);
        this.selectedEndDate = this.formatDateForInput(quarterEnd);
        break;
      case 'lastYear':
        const lastYear = new Date(today.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
        this.selectedStartDate = this.formatDateForInput(lastYear);
        this.selectedEndDate = this.formatDateForInput(lastYearEnd);
        break;
      case 'thisYear':
        const thisYear = new Date(today.getFullYear(), 0, 1);
        this.selectedStartDate = this.formatDateForInput(thisYear);
        this.selectedEndDate = this.formatDateForInput(today);
        break;
      case 'all':
        this.selectedStartDate = '';
        this.selectedEndDate = '';
        break;
    }
    
    this.onFilterChange();
  }

  // Clear all filters
  clearAllFilters() {
    this.selectedStartDate = '';
    this.selectedEndDate = '';
    this.selectedCategories = [];
    this.searchQuery = '';
    this.minAmount = '';
    this.maxAmount = '';
    this.selectedDatePreset = 'all'; // Reset to "All Time" filter
    this.comparisonMode = false;
    this.selectedCategoriesForComparison = [];
    this.onFilterChange();
  }

  // Clear search text
  clearSearch() {
    this.searchQuery = '';
    this.onFilterChange();
  }

  // Generate chart data
  generateChartData() {
    const filteredExpenses = this.getFilteredExpenses();
    
    if (filteredExpenses.length === 0) {
      this.trendData = null;
      this.pieData = null;
      this.barData = null;
      return;
    }

    // Use default 12 months for charts
    const months = 12;
    this.trendData = this.chartService.generateTrendData(filteredExpenses, months);
    this.pieData = this.chartService.generatePieData(filteredExpenses, this.categories);
    this.barData = this.chartService.generateBarData(filteredExpenses, months);
  }

  // Toggle charts visibility
  toggleCharts(event?: Event) {
    // Prevent default behavior and stop propagation
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    this.showCharts = !this.showCharts;
    
    if (this.showCharts) {
      // Generate chart data
      this.generateChartData();
    }
    
    // Remove focus from the button to prevent focus issues
    if (event && event.target) {
      (event.target as HTMLElement).blur();
    }
  }

  // Get chart options
  getTrendOptions() {
    return this.chartService.getTrendOptions();
  }

  getPieOptions() {
    return this.chartService.getPieOptions();
  }

  getBarOptions() {
    return this.chartService.getBarOptions();
  }

  getSparklineOptions() {
    return this.chartService.getSparklineOptions();
  }

  // Generate sparkline data for a category
  getCategorySparklineData(categoryId: string) {
    const filteredExpenses = this.getFilteredExpenses();
    const data = this.chartService.generateSparklineData(filteredExpenses, categoryId);
    
    return {
      labels: Array.from({ length: 30 }, (_, i) => ''),
      datasets: [{
        data: data,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0
      }]
    };
  }


  // Show category expenses using dialog service
  async showCategoryExpenses(categoryAnalysis: CategoryAnalysis) {
    const categoryExpenses = this.getExpensesForCategory(categoryAnalysis.category.id);
    
    // Prepare expenses data for the dialog
    const expensesData = categoryExpenses.map(expense => ({
      id: expense.id,
      description: expense.description || 'No description',
      amount: expense.amount,
      date: expense.date,
      categoryId: expense.categoryId
    }));

    // Show the expense list in the dialog
    await this.dialogService.showExpenseList(
      expensesData,
      categoryAnalysis.category.name,
      categoryAnalysis.category.icon,
      categoryAnalysis.category.color
    );
  }

  // Show monthly expenses using dialog service
  async showMonthlyExpenses(categoryAnalysis: CategoryAnalysis, monthData: MonthlyData) {
    // Get expenses for this category in the specific month
    const monthlyExpenses = this.getExpensesForCategoryAndMonth(categoryAnalysis.category.id, monthData);
    
    // Prepare expenses data for the dialog
    const expensesData = monthlyExpenses.map(expense => ({
      id: expense.id,
      description: expense.description || 'No description',
      amount: expense.amount,
      date: expense.date,
      categoryId: expense.categoryId
    }));

    // Show the expense list in the dialog
    await this.dialogService.showExpenseList(
      expensesData,
      `${categoryAnalysis.category.name} - ${monthData.month} ${monthData.year}`,
      categoryAnalysis.category.icon,
      categoryAnalysis.category.color
    );
  }

  // Get expenses for a specific category
  getExpensesForCategory(categoryId: string): Expense[] {
    return this.getFilteredExpenses().filter(expense => expense.categoryId === categoryId);
  }

  // Get expenses for a specific category and month
  getExpensesForCategoryAndMonth(categoryId: string, monthData: MonthlyData): Expense[] {
    const filteredExpenses = this.getFilteredExpenses();
    const categoryExpenses = filteredExpenses.filter(expense => expense.categoryId === categoryId);
    
    return categoryExpenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      const expenseMonth = expenseDate.getMonth() + 1; // JavaScript months are 0-based
      const expenseYear = expenseDate.getFullYear();
      
      // Convert month name to number
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const targetMonth = monthNames.indexOf(monthData.month) + 1;
      
      return expenseMonth === targetMonth && expenseYear === monthData.year;
    });
  }

  // Comparison functionality
  toggleComparisonMode() {
    this.comparisonMode = !this.comparisonMode;
    if (!this.comparisonMode) {
      this.selectedCategoriesForComparison = [];
    }
  }

  toggleCategoryForComparison(categoryId: string) {
    const index = this.selectedCategoriesForComparison.indexOf(categoryId);
    if (index > -1) {
      this.selectedCategoriesForComparison.splice(index, 1);
    } else {
      if (this.selectedCategoriesForComparison.length < 3) { // Limit to 3 categories for comparison
        this.selectedCategoriesForComparison.push(categoryId);
      }
    }
  }

  getComparisonCategories(): CategoryAnalysis[] {
    return this.categoryAnalysis.filter(analysis => 
      this.selectedCategoriesForComparison.includes(analysis.category.id)
    );
  }

  getCategoryColor(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.color || '#999';
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown Category';
  }

  getCategoryIcon(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.icon || '❓';
  }

  getCategoryExpenseCount(categoryId: string): number {
    // Get expenses filtered by date range only (not by category)
    const dateFilteredExpenses = this.expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      const expenseDateString = expenseDate.toISOString().split('T')[0];
      
      const startDateMatch = !this.selectedStartDate || expenseDateString >= this.selectedStartDate;
      const endDateMatch = !this.selectedEndDate || expenseDateString <= this.selectedEndDate;
      
      return startDateMatch && endDateMatch;
    });
    
    return dateFilteredExpenses.filter(expense => expense.categoryId === categoryId).length;
  }

  trackByCategoryId(index: number, category: Category): string {
    return category.id;
  }

  // Get only categories that have expenses in the current filtered data
  getUsedCategories(): Category[] {
    const filteredExpenses = this.getFilteredExpenses();
    const usedCategoryIds = [...new Set(filteredExpenses.map(expense => expense.categoryId))];
    return this.categories.filter(category => usedCategoryIds.includes(category.id));
  }

  // Update used categories when filters change
  updateUsedCategories(): void {
    this.usedCategories = this.getUsedCategories();
  }

  // Check if there are any used categories
  hasUsedCategories(): boolean {
    return this.usedCategories.length > 0;
  }

  getMaxDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Multiselect category methods
  toggleCategoryDropdown(): void {
    this.isCategoryDropdownOpen = !this.isCategoryDropdownOpen;
    
    // Calculate dropdown alignment when opening
    if (this.isCategoryDropdownOpen) {
      this.calculateDropdownAlignment();
    }
    
    // Apply filter when dropdown is closed
    if (!this.isCategoryDropdownOpen) {
      this.onFilterChange();
    }
  }

  calculateDropdownAlignment(): void {
    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      const dropdown = document.querySelector('.multiselect-options');
      if (dropdown) {
        const rect = dropdown.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const containerRect = dropdown.parentElement?.getBoundingClientRect();
        
        if (containerRect) {
          const spaceRight = viewportWidth - containerRect.left;
          const spaceLeft = containerRect.right;
          const dropdownWidth = Math.min(400, viewportWidth - 32); // 32px for margins
          
          if (spaceRight < dropdownWidth && spaceLeft > dropdownWidth) {
            this.dropdownAlignment = 'right';
          } else if (spaceRight < dropdownWidth && spaceLeft < dropdownWidth) {
            this.dropdownAlignment = 'center';
          } else {
            this.dropdownAlignment = 'left';
          }
        }
      }
    }, 0);
  }

  isCategorySelected(categoryId: string): boolean {
    return this.selectedCategories.includes(categoryId);
  }

  toggleCategorySelection(categoryId: string): void {
    const index = this.selectedCategories.indexOf(categoryId);
    if (index > -1) {
      this.selectedCategories.splice(index, 1);
    } else {
      this.selectedCategories.push(categoryId);
    }
    // Don't call onFilterChange() here - let user select multiple categories first
  }

  selectAllCategories(): void {
    this.selectedCategories = this.availableCategories.map(cat => cat.id);
    // Don't call onFilterChange() here - let user see all selected categories
  }

  clearAllCategories(): void {
    this.selectedCategories = [];
    // Don't call onFilterChange() here - let user see cleared state
  }


  getFilterLabel(): string {
    if (this.selectedStartDate && this.selectedEndDate) {
      const startDate = new Date(this.selectedStartDate);
      const endDate = new Date(this.selectedEndDate);
      
      const startFormatted = startDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      const endFormatted = endDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      return `${startFormatted} to ${endFormatted}`;
    } else if (this.selectedStartDate) {
      const startDate = new Date(this.selectedStartDate);
      const startFormatted = startDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      return `From ${startFormatted}`;
    } else if (this.selectedEndDate) {
      const endDate = new Date(this.selectedEndDate);
      const endFormatted = endDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      return `Until ${endFormatted}`;
    }
    return 'All time';
  }

  exportAnalysis() {
    const data = {
      period: this.getFilterLabel(),
      totalExpenses: this.totalExpenses,
      totalExpenseCount: this.totalExpenseCount,
      averageExpenseAmount: this.averageExpenseAmount,
      categoryAnalysis: this.categoryAnalysis.map(analysis => ({
        category: analysis.category.name,
        totalAmount: analysis.totalAmount,
        percentage: analysis.percentage,
        expenseCount: analysis.expenseCount,
        averageAmount: analysis.averageAmount,
        monthlyBreakdown: analysis.monthlyBreakdown
      }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateRange = this.selectedStartDate && this.selectedEndDate 
      ? `${this.selectedStartDate}-to-${this.selectedEndDate}` 
      : this.selectedStartDate 
        ? `from-${this.selectedStartDate}` 
        : this.selectedEndDate 
          ? `until-${this.selectedEndDate}` 
          : 'all-time';
    a.download = `expense-analysis-${dateRange}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  getTopCategories(limit: number = 5): CategoryAnalysis[] {
    return this.categoryAnalysis.slice(0, limit);
  }

  getCategoryTrend(categoryId: string): { trend: string; percentage: number } {
    const category = this.categoryAnalysis.find(c => c.category.id === categoryId);
    if (!category || category.monthlyBreakdown.length < 2) {
      return { trend: 'stable', percentage: 0 };
    }
    
    const sortedMonths = category.monthlyBreakdown.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return parseInt(a.month) - parseInt(b.month);
    });
    
    const recent = sortedMonths[sortedMonths.length - 1];
    const previous = sortedMonths[sortedMonths.length - 2];
    
    if (previous.amount === 0) {
      return { trend: 'new', percentage: 100 };
    }
    
    const change = ((recent.amount - previous.amount) / previous.amount) * 100;
    
    if (change > 10) return { trend: 'up', percentage: change };
    if (change < -10) return { trend: 'down', percentage: Math.abs(change) };
    return { trend: 'stable', percentage: Math.abs(change) };
  }

  // Get orphaned expenses (expenses with missing categories)
  getOrphanedExpenses(): Expense[] {
    return this.expenses.filter(expense => 
      !this.categories.find(c => c.id === expense.categoryId)
    );
  }

  // Get orphaned category analysis
  getOrphanedCategoryAnalysis(): CategoryAnalysis[] {
    return this.categoryAnalysis.filter(analysis => 
      analysis.category.name === 'Orphaned Category'
    );
  }

  // Check if there are any orphaned expenses
  hasOrphanedExpenses(): boolean {
    return this.getOrphanedExpenses().length > 0;
  }

  // Get orphaned expenses count
  getOrphanedExpensesCount(): number {
    return this.getOrphanedExpenses().length;
  }

  // Get total amount of orphaned expenses
  getOrphanedExpensesAmount(): number {
    return this.getOrphanedExpenses().reduce((sum, expense) => sum + expense.amount, 0);
  }

  // Get detailed orphaned expenses information
  getOrphanedExpensesDetails(): { expense: Expense; categoryId: string }[] {
    return this.getOrphanedExpenses().map(expense => ({
      expense,
      categoryId: expense.categoryId
    }));
  }

  // Get orphaned expenses by category ID
  getOrphanedExpensesByCategoryId(categoryId: string): Expense[] {
    return this.getOrphanedExpenses().filter(expense => expense.categoryId === categoryId);
  }

  // Get unique orphaned category IDs
  getOrphanedCategoryIds(): string[] {
    const orphanedIds = new Set<string>();
    this.getOrphanedExpenses().forEach(expense => {
      orphanedIds.add(expense.categoryId);
    });
    return Array.from(orphanedIds);
  }

  // Log detailed information about orphaned expenses
  logOrphanedExpensesDetails(): void {
    const orphanedExpenses = this.getOrphanedExpenses();
    
    if (orphanedExpenses.length === 0) {
      console.log('✅ No orphaned expenses found - all expenses have valid categories!');
      return;
    }

    console.group('🚨 ORPHANED EXPENSES DETECTED');
    console.log(`📊 Total orphaned expenses: ${orphanedExpenses.length}`);
    console.log(`💰 Total orphaned amount: ₹${this.getOrphanedExpensesAmount().toLocaleString()}`);
    
    // Group by category ID
    const orphanedByCategoryId = new Map<string, Expense[]>();
    orphanedExpenses.forEach(expense => {
      if (!orphanedByCategoryId.has(expense.categoryId)) {
        orphanedByCategoryId.set(expense.categoryId, []);
      }
      orphanedByCategoryId.get(expense.categoryId)!.push(expense);
    });

    console.log(`🏷️ Unique orphaned category IDs: ${orphanedByCategoryId.size}`);
    
    // Log details for each orphaned category ID
    orphanedByCategoryId.forEach((expenses, categoryId) => {
      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      console.group(`📌 Category ID: "${categoryId}" (${expenses.length} expenses, ₹${totalAmount.toLocaleString()})`);
      
      expenses.forEach((expense, index) => {
        console.log(`${index + 1}. ${expense.description || 'No description'} - ₹${expense.amount.toLocaleString()} (${expense.date})`);
        console.log(`   ID: ${expense.id}`);
        console.log(`   Category ID: "${expense.categoryId}"`);
        console.log(`   Payment Method: ${expense.paymentMethod || 'Not specified'}`);
        console.log(`   Priority: ${expense.priority || 'Not specified'}`);
        if (expense.notes) console.log(`   Notes: ${expense.notes}`);
        if (expense.location) console.log(`   Location: ${expense.location}`);
        console.log('---');
      });
      
      console.groupEnd();
    });

    // Log available categories for reference
    console.group('🏷️ Available Categories (for reference)');
    this.categories.forEach(category => {
      console.log(`ID: "${category.id}" | Name: ${category.name} | Icon: ${category.icon} | Color: ${category.color}`);
    });
    console.groupEnd();

    // Log summary statistics
    console.group('📈 Summary Statistics');
    console.log(`📊 Total expenses: ${this.expenses.length}`);
    console.log(`✅ Valid expenses: ${this.expenses.length - orphanedExpenses.length}`);
    console.log(`❌ Orphaned expenses: ${orphanedExpenses.length}`);
    console.log(`📊 Orphaned percentage: ${((orphanedExpenses.length / this.expenses.length) * 100).toFixed(2)}%`);
    
    const validExpensesAmount = this.expenses.reduce((sum, expense) => {
      const isValid = this.categories.find(c => c.id === expense.categoryId);
      return isValid ? sum + expense.amount : sum;
    }, 0);
    
    console.log(`💰 Valid expenses amount: ₹${validExpensesAmount.toLocaleString()}`);
    console.log(`💰 Orphaned expenses amount: ₹${this.getOrphanedExpensesAmount().toLocaleString()}`);
    console.log(`📊 Orphaned amount percentage: ${((this.getOrphanedExpensesAmount() / (validExpensesAmount + this.getOrphanedExpensesAmount())) * 100).toFixed(2)}%`);
    console.groupEnd();

    console.groupEnd();
  }
}
