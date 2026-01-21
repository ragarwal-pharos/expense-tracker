import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables } from 'chart.js';
import { Subject, Subscription, combineLatest } from 'rxjs';
import { debounceTime, take } from 'rxjs/operators';
import { isDevMode } from '@angular/core';

// Register Chart.js components
Chart.register(...registerables);
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { FirebaseService } from '../../core/services/firebase.service';
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
  monthNumber?: number; // Optional month number for sorting
  amount: number;
  expenseCount: number;
  percentage: number;
}


@Component({
  selector: 'app-expense-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LoadingComponent, BaseChartDirective],
  templateUrl: './expense-analysis.component.html',
  styleUrls: ['./expense-analysis.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
  selectedDatePreset = 'thisMonth'; // Default to "This Month"
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
  
  // Sorting options
  sortBy: 'percentage' | 'transactionCount' | 'average' | 'name' = 'percentage';
  sortOrder: 'asc' | 'desc' = 'desc';
  
  // Performance optimization: Cached values
  private cachedFilteredExpenses: Expense[] | null = null;
  private filterCacheKey: string = '';
  private categoryMap: Map<string, Category> = new Map();
  private categoryTrendCache: Map<string, { trend: string; percentage: number }> = new Map();
  private categoryExpenseCountCache: Map<string, number> = new Map();
  private filterLabelCache: string = '';
  private filterChangeSubject = new Subject<void>();
  private filterChangeSubscription: any;
  private dataSubscription: Subscription = new Subscription();
  private dataLoaded = false;
  
  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private firebaseService: FirebaseService,
    private dialogService: DialogService,
    private chartService: ChartService,
    private chartConfigService: ChartConfigService,
    private cdr: ChangeDetectorRef
  ) {
    // Debounce filter changes to avoid excessive recalculations
    this.filterChangeSubscription = this.filterChangeSubject.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.onFilterChangeDebounced();
    });
  }

  ngOnInit() {
    // Use Firebase observables for faster loading and real-time updates
    // This uses already-loaded data if available and gets real-time updates
    this.loadDataFromObservables();
  }

  ngOnDestroy() {
    // Cleanup subscriptions
    if (this.filterChangeSubscription) {
      this.filterChangeSubscription.unsubscribe();
    }
    this.dataSubscription.unsubscribe();
    this.filterChangeSubject.complete();
    // Clear caches
    this.cachedFilteredExpenses = null;
    this.categoryMap.clear();
    this.categoryTrendCache.clear();
    this.categoryExpenseCountCache.clear();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.multiselect-container')) {
      // Apply filter when dropdown is closed by clicking outside
      if (this.isCategoryDropdownOpen) {
        this.isCategoryDropdownOpen = false;
        this.onFilterChange();
      }
    }
  }

  // Load data using Firebase observables for faster loading
  // This uses already-loaded data if available and provides real-time updates
  loadDataFromObservables() {
    // Subscribe to both expenses and categories observables
    // combineLatest will emit as soon as both have values (even if already loaded)
    this.dataSubscription.add(
      combineLatest([
        this.firebaseService.expenses$,
        this.firebaseService.categories$
      ]).subscribe(([expenses, categories]) => {
        // Update data as soon as it arrives
        this.expenses = expenses;
        this.categories = categories;
        
        // Build category map for O(1) lookups
        this.categoryMap.clear();
        this.categories.forEach(cat => this.categoryMap.set(cat.id, cat));
        
        // Only initialize filters and perform analysis on first load
        if (!this.dataLoaded) {
          this.initializeFilters();
          this.dataLoaded = true;
          
          // Log detailed information about orphaned expenses (only in dev mode, first time)
          if (isDevMode()) {
            this.logOrphanedExpensesDetails();
          }
        }
        
        // Perform analysis whenever data changes
        this.performAnalysis();
        
        // Invalidate cache when data changes
        this.invalidateCache();
        
        // Update loading state
        if (this.isLoading) {
          this.isLoading = false;
          this.cdr.markForCheck(); // Trigger change detection for OnPush
        }
      })
    );
    
    // Also subscribe to loading state
    this.dataSubscription.add(
      this.firebaseService.loading$.subscribe(loading => {
        // Only set loading to true if we haven't loaded data yet
        if (!this.dataLoaded) {
          this.isLoading = loading;
          this.cdr.markForCheck();
        }
      })
    );
  }
  
  // Legacy async method kept for backward compatibility (not used anymore)
  async loadData() {
    try {
      this.expenses = await this.expenseService.getAll();
      this.categories = await this.categoryService.getAll();
      
      // Build category map for O(1) lookups
      this.categoryMap.clear();
      this.categories.forEach(cat => this.categoryMap.set(cat.id, cat));
      
      // Log detailed information about orphaned expenses (only in dev mode)
      if (isDevMode()) {
        this.logOrphanedExpensesDetails();
      }
      
      // Invalidate cache when data changes
      this.invalidateCache();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }
  
  private invalidateCache(): void {
    this.cachedFilteredExpenses = null;
    this.filterCacheKey = '';
    this.categoryTrendCache.clear();
    this.categoryExpenseCountCache.clear();
    this.filterLabelCache = '';
  }
  
  private getFilterCacheKey(): string {
    return `${this.selectedStartDate}|${this.selectedEndDate}|${this.selectedCategories.join(',')}|${this.searchQuery}|${this.minAmount}|${this.maxAmount}`;
  }

  initializeFilters() {
    // Apply default date range preset ("This Month")
    this.applyDatePreset('thisMonth');

    // Initialize categories - only show categories that have expenses
    this.updateAvailableCategories();
    this.updateUsedCategories();
  }

  getFilteredExpenses(): Expense[] {
    const cacheKey = this.getFilterCacheKey();
    
    // Return cached result if filters haven't changed
    if (this.cachedFilteredExpenses !== null && this.filterCacheKey === cacheKey) {
      return this.cachedFilteredExpenses;
    }
    
    // Perform filtering
    const filtered = this.expenses.filter(expense => {
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
    
    // Cache the result
    this.cachedFilteredExpenses = filtered;
    this.filterCacheKey = cacheKey;
    
    return filtered;
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
    
    // Create category analysis - use cached category map for O(1) lookup
    this.categoryAnalysis = Array.from(categoryMap.entries()).map(([categoryId, expenses]) => {
      const category = this.categoryMap.get(categoryId); // Use Map for O(1) lookup
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
    });
    
    // Clear trend cache when analysis changes
    this.categoryTrendCache.clear();
    this.categoryExpenseCountCache.clear();
    
    // Apply sorting
    this.applySorting();
    
    // Update pre-computed top categories with trends
    this.updateTopCategoriesWithTrends();
    
    // Trigger change detection manually for OnPush
    this.cdr.markForCheck();
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
    
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    return Array.from(monthlyMap.entries()).map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-');
      const monthName = monthNames[parseInt(month) - 1];
      
      return {
        month: monthName,
        year: parseInt(year),
        monthNumber: parseInt(month), // Add month number for sorting
        amount: data.amount,
        expenseCount: data.count,
        percentage: categoryTotalAmount > 0 ? (data.amount / categoryTotalAmount) * 100 : 0
      };
    }).sort((a, b) => {
      // Sort by year descending (most recent first)
      if (a.year !== b.year) return b.year - a.year;
      // Sort by month descending (most recent month first) when years are equal
      return b.monthNumber - a.monthNumber;
    });
  }

  applySorting() {
    this.categoryAnalysis.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortBy) {
        case 'percentage':
          comparison = a.percentage - b.percentage;
          break;
        case 'transactionCount':
          comparison = a.expenseCount - b.expenseCount;
          break;
        case 'average':
          comparison = a.averageAmount - b.averageAmount;
          break;
        case 'name':
          comparison = a.category.name.localeCompare(b.category.name);
          break;
      }
      
      // Apply sort order
      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    // Update pre-computed top categories with trends after sorting
    this.updateTopCategoriesWithTrends();
  }

  onSortChange() {
    this.applySorting();
    this.cdr.markForCheck(); // Trigger change detection for OnPush
  }

  toggleSortOrder() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.applySorting();
    this.cdr.markForCheck(); // Trigger change detection for OnPush
  }

  onFilterChange() {
    // Invalidate cache when filters change
    this.invalidateCache();
    // Use debounced version for better performance
    this.filterChangeSubject.next();
  }
  
  private onFilterChangeDebounced() {
    this.updateUsedCategories();
    this.performAnalysis();
    if (this.showCharts) {
      this.generateChartData();
    }
    this.cdr.markForCheck(); // Trigger change detection for OnPush
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
    
    // Apply immediately for date presets (no debounce)
    this.invalidateCache();
    this.updateUsedCategories();
    this.performAnalysis();
    if (this.showCharts) {
      this.generateChartData();
    }
  }

  // Clear all filters
  clearAllFilters() {
    this.selectedCategories = [];
    this.searchQuery = '';
    this.minAmount = '';
    this.maxAmount = '';
    this.comparisonMode = false;
    this.selectedCategoriesForComparison = [];
    
    // Reset to "This Month" filter (default)
    this.applyDatePreset('thisMonth');
  }

  // Clear search text
  clearSearch() {
    this.searchQuery = '';
    // Apply immediately when clearing search
    this.invalidateCache();
    this.updateUsedCategories();
    this.performAnalysis();
    if (this.showCharts) {
      this.generateChartData();
    }
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
    const expenseCount = categoryExpenses.length;
    
    // Prepare expenses data for the dialog
    const expensesData = categoryExpenses.map(expense => ({
      id: expense.id,
      description: expense.description || 'No description',
      amount: expense.amount,
      date: expense.date,
      categoryId: expense.categoryId
    }));

    // Create title with expense count
    const titleWithCount = `${categoryAnalysis.category.name} (${expenseCount} ${expenseCount === 1 ? 'expense' : 'expenses'})`;

    // Show the expense list in the dialog
    await this.dialogService.showExpenseList(
      expensesData,
      titleWithCount,
      categoryAnalysis.category.icon,
      categoryAnalysis.category.color
    );
  }

  // Show monthly expenses using dialog service
  async showMonthlyExpenses(categoryAnalysis: CategoryAnalysis, monthData: MonthlyData) {
    // Get expenses for this category in the specific month
    const monthlyExpenses = this.getExpensesForCategoryAndMonth(categoryAnalysis.category.id, monthData);
    const expenseCount = monthlyExpenses.length;
    
    // Prepare expenses data for the dialog
    const expensesData = monthlyExpenses.map(expense => ({
      id: expense.id,
      description: expense.description || 'No description',
      amount: expense.amount,
      date: expense.date,
      categoryId: expense.categoryId
    }));

    // Create title with expense count
    const titleWithCount = `${categoryAnalysis.category.name} - ${monthData.month} ${monthData.year} (${expenseCount} ${expenseCount === 1 ? 'expense' : 'expenses'})`;

    // Show the expense list in the dialog
    await this.dialogService.showExpenseList(
      expensesData,
      titleWithCount,
      categoryAnalysis.category.icon,
      categoryAnalysis.category.color,
      expenseCount === 0 ? 'No expenses found for this category in the selected month.' : undefined
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
    const category = this.categoryMap.get(categoryId); // Use Map for O(1) lookup
    return category?.color || '#999';
  }

  getCategoryName(categoryId: string): string {
    const category = this.categoryMap.get(categoryId); // Use Map for O(1) lookup
    return category?.name || 'Unknown Category';
  }

  getCategoryIcon(categoryId: string): string {
    const category = this.categoryMap.get(categoryId); // Use Map for O(1) lookup
    return category?.icon || '❓';
  }

  getCategoryExpenseCount(categoryId: string): number {
    // Check cache first
    if (this.categoryExpenseCountCache.has(categoryId)) {
      return this.categoryExpenseCountCache.get(categoryId)!;
    }
    
    // Get expenses filtered by date range only (not by category)
    const dateFilteredExpenses = this.expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      const expenseDateString = expenseDate.toISOString().split('T')[0];
      
      const startDateMatch = !this.selectedStartDate || expenseDateString >= this.selectedStartDate;
      const endDateMatch = !this.selectedEndDate || expenseDateString <= this.selectedEndDate;
      
      return startDateMatch && endDateMatch;
    });
    
    const count = dateFilteredExpenses.filter(expense => expense.categoryId === categoryId).length;
    this.categoryExpenseCountCache.set(categoryId, count);
    return count;
  }

  trackByCategoryId(index: number, category: Category): string {
    return category.id;
  }

  // Get categories that have expenses (from all expenses, not filtered)
  getCategoriesWithExpenses(): Category[] {
    const categoryIdsWithExpenses = new Set(this.expenses.map(expense => expense.categoryId));
    return this.categories.filter(category => categoryIdsWithExpenses.has(category.id));
  }

  // Update available categories to show only those with expenses
  updateAvailableCategories(): void {
    this.availableCategories = this.getCategoriesWithExpenses();
  }

  // Get only categories that have expenses in the current filtered data
  getUsedCategories(): Category[] {
    const filteredExpenses = this.getFilteredExpenses();
    const usedCategoryIds = new Set(filteredExpenses.map(expense => expense.categoryId));
    return this.categories.filter(category => usedCategoryIds.has(category.id));
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
  toggleCategoryDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    const wasOpen = this.isCategoryDropdownOpen;
    this.isCategoryDropdownOpen = !this.isCategoryDropdownOpen;
    
    // Calculate dropdown alignment when opening
    if (this.isCategoryDropdownOpen) {
      this.calculateDropdownAlignment();
    }
    
    // Apply filter when dropdown is closed (only if it was open before)
    if (wasOpen && !this.isCategoryDropdownOpen) {
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
          // Trigger change detection for OnPush after alignment is calculated
          this.cdr.markForCheck();
        }
      }
    }, 0);
  }

  isCategorySelected(categoryId: string): boolean {
    return this.selectedCategories.includes(categoryId);
  }

  toggleCategorySelection(categoryId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const index = this.selectedCategories.indexOf(categoryId);
    if (index > -1) {
      this.selectedCategories.splice(index, 1);
    } else {
      this.selectedCategories.push(categoryId);
    }
    // Apply filter immediately when category selection changes
    this.onFilterChange();
  }

  selectAllCategories(): void {
    this.selectedCategories = this.availableCategories.map(cat => cat.id);
    // Apply filter immediately when all categories are selected
    this.onFilterChange();
  }

  clearAllCategories(): void {
    this.selectedCategories = [];
    // Apply filter immediately when all categories are cleared
    this.onFilterChange();
  }


  getFilterLabel(): string {
    // Return cached value if dates haven't changed
    const dateKey = `${this.selectedStartDate}|${this.selectedEndDate}`;
    if (this.filterLabelCache && this.filterLabelCache.startsWith(dateKey)) {
      return this.filterLabelCache.split('|')[1];
    }
    
    let result: string;
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
      
      result = `${startFormatted} to ${endFormatted}`;
    } else if (this.selectedStartDate) {
      const startDate = new Date(this.selectedStartDate);
      const startFormatted = startDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      result = `From ${startFormatted}`;
    } else if (this.selectedEndDate) {
      const endDate = new Date(this.selectedEndDate);
      const endFormatted = endDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      result = `Until ${endFormatted}`;
    } else {
      result = 'All time';
    }
    
    // Cache the result with the date key
    this.filterLabelCache = `${dateKey}|${result}`;
    return result;
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
  
  // Pre-computed top categories with trends for template optimization
  topCategoriesWithTrends: Array<CategoryAnalysis & { trend: { trend: string; percentage: number } }> = [];
  
  private updateTopCategoriesWithTrends(): void {
    this.topCategoriesWithTrends = this.getTopCategories(5).map(category => ({
      ...category,
      trend: this.getCategoryTrend(category.category.id)
    }));
  }

  getCategoryTrend(categoryId: string): { trend: string; percentage: number } {
    // Check cache first
    if (this.categoryTrendCache.has(categoryId)) {
      return this.categoryTrendCache.get(categoryId)!;
    }
    
    const category = this.categoryAnalysis.find(c => c.category.id === categoryId);
    if (!category || category.monthlyBreakdown.length < 2) {
      const result = { trend: 'stable', percentage: 0 };
      this.categoryTrendCache.set(categoryId, result);
      return result;
    }
    
    // Create a copy before sorting to avoid mutating the original array
    // Sort in ascending order (oldest first) for trend calculation
    const sortedMonths = [...category.monthlyBreakdown].sort((a, b) => {
      // Sort by year ascending (oldest first)
      if (a.year !== b.year) return a.year - b.year;
      // Sort by month ascending (oldest month first) when years are equal
      return (a.monthNumber ?? 0) - (b.monthNumber ?? 0);
    });
    
    const recent = sortedMonths[sortedMonths.length - 1];
    const previous = sortedMonths[sortedMonths.length - 2];
    
    let result: { trend: string; percentage: number };
    if (previous.amount === 0) {
      result = { trend: 'new', percentage: 100 };
    } else {
      const change = ((recent.amount - previous.amount) / previous.amount) * 100;
      
      if (change > 10) {
        result = { trend: 'up', percentage: change };
      } else if (change < -10) {
        result = { trend: 'down', percentage: Math.abs(change) };
      } else {
        result = { trend: 'stable', percentage: Math.abs(change) };
      }
    }
    
    // Cache the result
    this.categoryTrendCache.set(categoryId, result);
    return result;
  }

  // Get orphaned expenses (expenses with missing categories)
  getOrphanedExpenses(): Expense[] {
    return this.expenses.filter(expense => 
      !this.categoryMap.has(expense.categoryId) // Use Map for O(1) lookup
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
    
    // Method kept for potential future use, but console.log statements removed
  }
}
