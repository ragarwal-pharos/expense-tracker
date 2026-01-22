import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables } from 'chart.js';
import { TradingService } from '../../core/services/trading.service';
import { FirebaseService } from '../../core/services/firebase.service';
import { DialogService } from '../../core/services/dialog.service';
import { LoadingComponent } from '../../shared/components/loading/loading.component';
import { Subscription, combineLatest } from 'rxjs';
import { Trade } from '../../core/models/trade.model';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-trading',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingComponent, BaseChartDirective],
  templateUrl: './trading.component.html',
  styleUrls: ['./trading.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradingComponent implements OnInit, OnDestroy {
  trades: Trade[] = [];
  
  newTrade: Trade = {
    id: '',
    symbol: '', // Empty string to match placeholder option value
    indexValue: 0,
    tradeType: '' as any, // Empty string to match placeholder option value
    isProfit: undefined as any, // undefined for boolean select
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  };

  // Available indices for dropdown
  availableIndices: string[] = ['nifty50', 'banknifty', 'finnifty', 'sensex'];
  
  // Available trade types
  availableTradeTypes: { value: 'call' | 'put'; label: string }[] = [
    { value: 'call', label: 'Call' },
    { value: 'put', label: 'Put' }
  ];

  // Input properties (strings for form inputs)
  amountInput: string = '';
  indexValueInput: string = '';

  // Filter properties
  globalSearch: string = '';
  filterSymbol: string = '';
  filterDateFrom: string = '';
  filterDateTo: string = '';
  filterProfitLoss: '' | 'profit' | 'loss' = ''; // Filter by profit/loss status
  filterTradeType: '' | 'call' | 'put' = ''; // Filter by trade type
  sortBy: 'date' | 'symbol' | 'tradeType' = 'date';
  sortOrder: 'asc' | 'desc' = 'desc';
  
  // Month/Year filter properties
  selectedMonth: string = '';
  selectedYear: string = '';
  filterByMonthYear: boolean = false; // Toggle to enable month/year filtering

  // Pagination properties - separate for each table
  // Trades List pagination
  currentPage: number = 1;
  itemsPerPage: number = 10; // Default to 10 records per page
  itemsPerPageOptions: number[] = [10, 25, 50, 100, 200];
  
  // Monthly Summary pagination
  monthlyCurrentPage: number = 1;
  monthlyItemsPerPage: number = 10;
  
  // Daily Summary pagination
  dailyCurrentPage: number = 1;
  dailyItemsPerPage: number = 10;

  // Loading states
  isLoading: boolean = true;
  isSaving: boolean = false;
  isDeleting: boolean = false;
  deletingTradeIds: Set<string> = new Set();

  // Expand/Collapse states
  isAddTradeExpanded: boolean = true;
  isFiltersExpanded: boolean = true;
  isTradesListExpanded: boolean = true;
  isMonthlySummaryExpanded: boolean = true;
  
  // Available months and years for filtering
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
  availableYears: string[] = [];

  // Chart data
  showCharts = false;
  monthlyPnlChartData: any = null;
  profitLossPieChartData: any = null;
  tradeTypeChartData: any = null;

  // Cached computed values for performance
  private _cachedFilteredTrades: Trade[] = [];
  private _cachedFilteredTradesKey: string = '';
  private _cachedDailySummary: Array<{
    date: string;
    totalTrades: number;
    profitCount: number;
    lossCount: number;
    totalProfit: number;
    totalLoss: number;
    netPnl: number;
  }> = [];
  private _cachedStatistics: {
    profitCount: number;
    lossCount: number;
    totalProfit: number;
    totalLoss: number;
    netPnl: number;
  } | null = null;

  private subscription: Subscription = new Subscription();

  constructor(
    private tradingService: TradingService,
    private firebaseService: FirebaseService,
    private dialogService: DialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Trading component is completely independent from Expenses
    // It only subscribes to trades$ observable, not expenses$ or categories$
    // All trading data is stored in separate 'trades' collection in Firebase
    
    // Initialize available years
    const currentYear = new Date().getFullYear();
    for (let year = 2020; year <= currentYear + 1; year++) {
      this.availableYears.push(year.toString());
    }
    
    // Ensure trades are loaded and real-time listener is set up
    this.firebaseService.loadTrades().then(() => {
      // Real-time listener will handle updates
    }).catch(error => {
      console.error('Error loading trades:', error);
    });
    
    // Subscribe to Firebase observables for real-time updates
    this.subscription.add(
      this.firebaseService.trades$.subscribe((trades) => {
        this.trades = [...trades]; // Create new array reference to trigger change detection
        // Clear caches when data changes
        this._cachedFilteredTrades = [];
        this._cachedFilteredTradesKey = '';
        this._cachedDailySummary = [];
        this._cachedStatistics = null;
        // Force change detection to update statistics, list, and monthly summary
        this.cdr.markForCheck();
        this.cdr.detectChanges();
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


  // Toggle sections
  toggleAddTradeSection() {
    this.isAddTradeExpanded = !this.isAddTradeExpanded;
  }

  toggleFiltersSection() {
    this.isFiltersExpanded = !this.isFiltersExpanded;
  }

  toggleTradesListSection() {
    this.isTradesListExpanded = !this.isTradesListExpanded;
  }

  // Clear all filters
  clearFilters() {
    this.filterSymbol = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.filterProfitLoss = '';
    this.filterTradeType = '';
    this.sortBy = 'date';
    this.sortOrder = 'desc';
    this.selectedMonth = '';
    this.selectedYear = '';
    this.filterByMonthYear = false;
    // Reset pagination for all tables
    this.currentPage = 1;
    this.monthlyCurrentPage = 1;
    this.dailyCurrentPage = 1;
    this.cdr.markForCheck();
  }

  // Check if any filters are active
  hasActiveFilters(): boolean {
    return !!(
      this.filterSymbol ||
      this.filterDateFrom ||
      this.filterDateTo ||
      this.filterProfitLoss ||
      this.filterTradeType ||
      this.filterByMonthYear ||
      this.selectedMonth ||
      this.selectedYear ||
      this.sortBy !== 'date' ||
      this.sortOrder !== 'desc'
    );
  }
  
  // Handle month/year filter change
  onMonthYearFilterChange() {
    if (this.filterByMonthYear && this.selectedMonth && this.selectedYear) {
      const monthIndex = parseInt(this.selectedMonth);
      const year = parseInt(this.selectedYear);
      
      // Set date range to the selected month
      const startDate = new Date(Date.UTC(year, monthIndex, 1));
      const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
      
      const formatDate = (date: Date) => {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      
      this.filterDateFrom = formatDate(startDate);
      this.filterDateTo = formatDate(endDate);
    } else {
      // Clear date filters if month/year filter is disabled
      if (!this.filterByMonthYear) {
        this.filterDateFrom = '';
        this.filterDateTo = '';
        this.selectedMonth = '';
        this.selectedYear = '';
      }
    }
    this.currentPage = 1; // Reset to first page
    this.cdr.markForCheck();
  }
  
  // Custom date range state
  showCustomDatePicker: boolean = false;
  
  // Preset date range methods
  setPresetDateRange(preset: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom') {
    if (preset === 'custom') {
      this.showCustomDatePicker = true;
      // Don't clear existing dates if custom is selected
      return;
    }
    
    this.showCustomDatePicker = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate: Date;
    let endDate: Date;
    
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    switch (preset) {
      case 'today':
        startDate = new Date(today);
        endDate = new Date(today);
        break;
        
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        endDate = new Date(startDate);
        break;
        
      case 'thisWeek':
        // Start of week (Sunday)
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay());
        endDate = new Date(today);
        break;
        
      case 'lastWeek':
        // Last week (Sunday to Saturday)
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay() - 7);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
        
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today);
        break;
        
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
    }
    
    this.filterDateFrom = formatDate(startDate);
    this.filterDateTo = formatDate(endDate);
    this.filterByMonthYear = false; // Disable month/year filter when using preset
    this.selectedMonth = '';
    this.selectedYear = '';
    
    // Reset pagination
    this.currentPage = 1;
    this.monthlyCurrentPage = 1;
    this.dailyCurrentPage = 1;
    
    this.cdr.markForCheck();
  }
  
  // Check if a preset is currently active
  isPresetActive(preset: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom'): boolean {
    if (preset === 'custom') {
      // Custom is active if dates are set but don't match any preset
      if (!this.filterDateFrom || !this.filterDateTo) return false;
      return !this.isPresetActive('today') && 
             !this.isPresetActive('yesterday') && 
             !this.isPresetActive('thisWeek') && 
             !this.isPresetActive('lastWeek') && 
             !this.isPresetActive('thisMonth') && 
             !this.isPresetActive('lastMonth');
    }
    if (!this.filterDateFrom || !this.filterDateTo) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const fromDate = new Date(this.filterDateFrom);
    const toDate = new Date(this.filterDateTo);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(0, 0, 0, 0);
    
    let expectedStart: Date;
    let expectedEnd: Date;
    
    switch (preset) {
      case 'today':
        expectedStart = new Date(today);
        expectedEnd = new Date(today);
        break;
      case 'yesterday':
        expectedStart = new Date(today);
        expectedStart.setDate(today.getDate() - 1);
        expectedEnd = new Date(expectedStart);
        break;
      case 'thisWeek':
        expectedStart = new Date(today);
        expectedStart.setDate(today.getDate() - today.getDay());
        expectedEnd = new Date(today);
        break;
      case 'lastWeek':
        expectedStart = new Date(today);
        expectedStart.setDate(today.getDate() - today.getDay() - 7);
        expectedEnd = new Date(expectedStart);
        expectedEnd.setDate(expectedStart.getDate() + 6);
        break;
      case 'thisMonth':
        expectedStart = new Date(today.getFullYear(), today.getMonth(), 1);
        expectedEnd = new Date(today);
        break;
      case 'lastMonth':
        expectedStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        expectedEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
    }
    
    return fromDate.getTime() === expectedStart.getTime() && 
           toDate.getTime() === expectedEnd.getTime();
  }
  
  // Clear preset date range
  clearPresetDateRange() {
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.filterByMonthYear = false;
    this.selectedMonth = '';
    this.selectedYear = '';
    this.showCustomDatePicker = false;
    
    // Reset pagination
    this.currentPage = 1;
    this.monthlyCurrentPage = 1;
    this.dailyCurrentPage = 1;
    
    this.cdr.markForCheck();
  }
  
  // Handle custom date range change
  onCustomDateRangeChange() {
    if (this.filterDateFrom && this.filterDateTo) {
      this.showCustomDatePicker = true;
      this.filterByMonthYear = false;
      this.selectedMonth = '';
      this.selectedYear = '';
      
      // Reset pagination
      this.currentPage = 1;
      this.monthlyCurrentPage = 1;
      this.dailyCurrentPage = 1;
    }
    this.cdr.markForCheck();
  }

  // Add new trade
  async addTrade() {
    if (!this.validateTrade()) {
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    try {
      const amount = parseInt(this.amountInput, 10) || 0;
      const indexValue = parseInt(this.indexValueInput, 10) || 0;
      
      // Ensure isProfit is explicitly a boolean
      const isProfit = typeof this.newTrade.isProfit === 'boolean' 
        ? this.newTrade.isProfit 
        : this.newTrade.isProfit === true || this.newTrade.isProfit === 'true';
      
      const tradeData: Omit<Trade, 'id'> = {
        symbol: this.newTrade.symbol.toLowerCase().trim(),
        indexValue: indexValue,
        tradeType: this.newTrade.tradeType,
        isProfit: isProfit,
        amount: amount,
        date: this.newTrade.date,
        notes: this.newTrade.notes || ''
      };
      
      const tradeId = await this.tradingService.add(tradeData);
      
      // Force reload trades to ensure UI updates immediately
      await this.firebaseService.loadTrades();
      
      // Wait a bit for the subscription to update this.trades
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Clear any cached summaries to force recalculation
      this._cachedDailySummary = [];
      
      // Force change detection to update UI immediately
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      
      await this.dialogService.success('Trade added successfully!');
      
      this.resetForm();
      
      // Force change detection again after form reset to ensure monthly summary updates
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error adding trade:', error);
      await this.dialogService.error('Error adding trade. Please try again.');
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  // Prevent non-integer key entries (dot, minus, exponent, plus)
  preventNonInteger(event: KeyboardEvent) {
    const invalidKeys = ['.', ',', '-', 'e', 'E', '+'];
    if (invalidKeys.includes(event.key)) {
      event.preventDefault();
    }
  }

  // Sanitize input to keep only digits for integer fields
  sanitizeIntegerInput(field: 'indexValueInput' | 'amountInput') {
    const current = this[field] || '';
    const cleaned = current.replace(/\D+/g, '');
    this[field] = cleaned;
  }

  // Validate trade
  validateTrade(): boolean {
    if (!this.newTrade.symbol || this.newTrade.symbol.trim() === '') {
      this.dialogService.error('Please select an index.');
      return false;
    }

    const indexValue = parseInt(this.indexValueInput, 10);
    if (isNaN(indexValue) || indexValue <= 0) {
      this.dialogService.error('Please enter a valid index value greater than 0.');
      return false;
    }

    if (!this.newTrade.tradeType) {
      this.dialogService.error('Please select a trade type.');
      return false;
    }

    if (this.newTrade.isProfit === undefined || this.newTrade.isProfit === null) {
      this.dialogService.error('Please select Profit or Loss.');
      return false;
    }

    const amount = parseInt(this.amountInput, 10);
    if (isNaN(amount) || amount <= 0) {
      this.dialogService.error('Please enter a valid amount greater than 0.');
      return false;
    }

    return true;
  }

  // Reset form
  resetForm() {
    this.newTrade = {
      id: '',
      symbol: '', // Empty string to match placeholder option value
      indexValue: 0,
      tradeType: '' as any, // Empty string to match placeholder option value
      isProfit: undefined as any, // undefined for boolean select
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      notes: ''
    };
    this.amountInput = '';
    this.indexValueInput = '';
  }

  // Edit trade - using modal
  async editTrade(trade: Trade) {
    const fields = [
      {
        name: 'symbol',
        label: 'Index',
        type: 'select' as const,
        value: trade.symbol,
        placeholder: 'Select Index',
        required: true,
        options: this.availableIndices.map(index => ({
          value: index,
          label: index.toUpperCase()
        }))
      },
      {
        name: 'indexValue',
        label: 'Index Value',
        type: 'number' as const,
        value: (trade.indexValue || 0).toString(),
        placeholder: 'Enter index value',
        required: true
      },
      {
        name: 'tradeType',
        label: 'Trade Type',
        type: 'select' as const,
        value: trade.tradeType || 'call',
        placeholder: 'Select Trade Type',
        required: true,
        options: [
          { value: 'call', label: 'Call' },
          { value: 'put', label: 'Put' }
        ]
      },
      {
        name: 'isProfit',
        label: 'Profit/Loss',
        type: 'select' as const,
        value: trade.isProfit ? 'true' : 'false',
        placeholder: 'Select Profit/Loss',
        required: true,
        options: [
          { value: 'true', label: 'Profit' },
          { value: 'false', label: 'Loss' }
        ]
      },
      {
        name: 'amount',
        label: 'Amount',
        type: 'number' as const,
        value: (trade.amount || 0).toString(),
        placeholder: 'Enter amount',
        required: true
      },
      {
        name: 'date',
        label: 'Trade Date',
        type: 'date' as const,
        value: trade.date,
        required: true
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'text' as const,
        value: trade.notes || '',
        placeholder: 'Additional notes',
        required: false
      }
    ];

    const result = await this.dialogService.form(fields, 'Edit Trade', 'Update trade details:');
    
    if (result) {
      const amount = parseFloat(result['amount']) || 0;
      const indexValue = parseFloat(result['indexValue']) || 0;
      const isProfit = result['isProfit'] === 'true';
      
      const updatedTrade: Trade = {
        ...trade,
        symbol: result['symbol'].toLowerCase().trim(),
        indexValue: indexValue,
        tradeType: (result['tradeType'] as 'call' | 'put') || 'call',
        isProfit: isProfit,
        amount: amount,
        date: result['date'],
        notes: result['notes'] || ''
      };

      await this.updateTrade(updatedTrade);
    }
  }

  // Update trade (called from edit modal)
  async updateTrade(trade: Trade) {
    this.isSaving = true;
    this.cdr.markForCheck();

    try {
      await this.tradingService.update(trade);
      
      // Clear caches to force recalculation
      this._cachedFilteredTrades = [];
      this._cachedFilteredTradesKey = '';
      this._cachedDailySummary = [];
      this._cachedStatistics = null;
      
      // Force reload trades to ensure we have the latest data
      await this.firebaseService.loadTrades();
      
      // Force change detection to update UI immediately
      this.cdr.detectChanges();
      
      await this.dialogService.success('Trade updated successfully!');
      
      // Force change detection again after dialog closes
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 100);
    } catch (error) {
      console.error('Error updating trade:', error);
      await this.dialogService.error('Error updating trade. Please try again.');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }


  // Delete trade
  async deleteTrade(trade: Trade) {
    const confirmDelete = await this.dialogService.confirm(
      `Are you sure you want to delete this trade?\n\nIndex: ${trade.symbol.toUpperCase()}\nIndex Value: ${trade.indexValue || 0}\nType: ${trade.tradeType?.toUpperCase() || 'N/A'}\nProfit/Loss: ${trade.isProfit ? 'Profit' : 'Loss'}\nAmount: ₹${trade.amount || 0}\nDate: ${trade.date}`,
      'Delete Trade'
    );
    
    if (confirmDelete) {
      this.deletingTradeIds.add(trade.id);
      this.cdr.markForCheck();
      
      try {
        // Optimistically update UI
        this.trades = this.trades.filter(t => t.id !== trade.id);
        this._cachedFilteredTrades = [];
        this._cachedFilteredTradesKey = '';
        this._cachedDailySummary = [];
        this._cachedStatistics = null;
        this.cdr.markForCheck();

        await this.tradingService.delete(trade.id);
        // Refresh from backend to stay in sync
        await this.firebaseService.loadTrades();
        this.cdr.markForCheck();
        await this.dialogService.success('Trade deleted successfully!');
      } catch (error) {
        console.error('Error deleting trade:', error);
        await this.dialogService.error('Error deleting trade. Please try again.');
      } finally {
        this.deletingTradeIds.delete(trade.id);
        this.cdr.markForCheck();
      }
    }
  }

  // Get filtered trades (with caching for performance)
  getFilteredTrades(): Trade[] {
    // Create cache key from filter values
    const cacheKey = `${this.globalSearch}|${this.filterSymbol}|${this.filterProfitLoss}|${this.filterTradeType}|${this.filterDateFrom}|${this.filterDateTo}|${this.sortBy}|${this.sortOrder}|${this.trades.length}`;
    
    // Return cached result if filters haven't changed
    if (this._cachedFilteredTradesKey === cacheKey && this._cachedFilteredTrades.length >= 0) {
      return this._cachedFilteredTrades;
    }
    
    // Reset pagination if filters changed (but not if it's just a page navigation)
    const previousCacheKey = this._cachedFilteredTradesKey;
    if (previousCacheKey && previousCacheKey !== cacheKey) {
      // Only reset if filters actually changed (not just trades.length)
      const previousFilters = previousCacheKey.split('|').slice(0, -1).join('|');
      const currentFilters = cacheKey.split('|').slice(0, -1).join('|');
      if (previousFilters !== currentFilters) {
        this.currentPage = 1;
        this.monthlyCurrentPage = 1;
        this.dailyCurrentPage = 1;
      }
    }
    
    let filtered = [...this.trades];
    
    // Global search - search across all trade properties
    if (this.globalSearch) {
      const search = this.globalSearch.toLowerCase().trim();
      filtered = filtered.filter(trade => {
        // Search in symbol/index
        if (trade.symbol && trade.symbol.toLowerCase().includes(search)) {
          return true;
        }
        // Search in notes
        if (trade.notes && trade.notes.toLowerCase().includes(search)) {
          return true;
        }
        // Search in index value
        if (trade.indexValue && trade.indexValue.toString().includes(search)) {
          return true;
        }
        // Search in trade type (call/put)
        if (trade.tradeType && trade.tradeType.toLowerCase().includes(search)) {
          return true;
        }
        // Search in profit/loss status
        const profitLossText = trade.isProfit ? 'profit' : 'loss';
        if (profitLossText.includes(search)) {
          return true;
        }
        // Search in amount
        if (trade.amount && trade.amount.toString().includes(search)) {
          return true;
        }
        // Search in formatted amount (with currency symbol) - only if search contains numbers
        if (/\d/.test(search)) {
          const formattedAmount = this.formatCurrency(trade.amount || 0).toLowerCase();
          if (formattedAmount.includes(search)) {
            return true;
          }
        }
        // Search in date
        if (trade.date && trade.date.includes(search)) {
          return true;
        }
        return false;
      });
    }
    
    // Filter by symbol
    if (this.filterSymbol) {
      const filterSymbolLower = this.filterSymbol.toLowerCase();
      filtered = filtered.filter(trade =>
        trade.symbol.toLowerCase().includes(filterSymbolLower)
      );
    }
    
    // Filter by profit/loss status
    if (this.filterProfitLoss) {
      if (this.filterProfitLoss === 'profit') {
        filtered = filtered.filter(trade => trade.isProfit === true);
      } else if (this.filterProfitLoss === 'loss') {
        filtered = filtered.filter(trade => trade.isProfit === false);
      }
    }
    
    // Filter by trade type
    if (this.filterTradeType) {
      filtered = filtered.filter(trade => trade.tradeType === this.filterTradeType);
    }
    
    // Filter by month/year if enabled
    if (this.filterByMonthYear && this.selectedMonth && this.selectedYear) {
      const monthIndex = parseInt(this.selectedMonth);
      const year = parseInt(this.selectedYear);
      filtered = filtered.filter(trade => {
        const tradeDate = new Date(trade.date);
        return tradeDate.getMonth() === monthIndex && 
               tradeDate.getFullYear() === year;
      });
    }
    
    // Filter by date range
    if (this.filterDateFrom) {
      filtered = filtered.filter(trade => trade.date >= this.filterDateFrom);
    }
    if (this.filterDateTo) {
      filtered = filtered.filter(trade => trade.date <= this.filterDateTo);
    }
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (this.sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'tradeType':
          const typeA = a.tradeType || '';
          const typeB = b.tradeType || '';
          comparison = typeA.localeCompare(typeB);
          break;
      }
      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    // Cache the result
    this._cachedFilteredTrades = filtered;
    this._cachedFilteredTradesKey = cacheKey;
    
    return filtered;
  }

  // Get paginated trades
  getPaginatedTrades(): Trade[] {
    const filtered = this.getFilteredTrades();
    const totalPages = Math.ceil(filtered.length / this.itemsPerPage);
    
    // Ensure currentPage is within valid bounds
    if (this.currentPage > totalPages && totalPages > 0) {
      this.currentPage = totalPages;
    } else if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return filtered.slice(startIndex, startIndex + this.itemsPerPage);
  }
  
  // Handle items per page change
  onItemsPerPageChange() {
    this.currentPage = 1; // Reset to first page when changing page size
    this.cdr.markForCheck();
  }
  
  // Monthly Summary Pagination Methods
  getPaginatedMonthlySummary() {
    const filtered = this.getFilteredMonthlySummary();
    const totalPages = Math.ceil(filtered.length / this.monthlyItemsPerPage);
    
    if (this.monthlyCurrentPage > totalPages && totalPages > 0) {
      this.monthlyCurrentPage = totalPages;
    } else if (this.monthlyCurrentPage < 1) {
      this.monthlyCurrentPage = 1;
    }
    
    const startIndex = (this.monthlyCurrentPage - 1) * this.monthlyItemsPerPage;
    return filtered.slice(startIndex, startIndex + this.monthlyItemsPerPage);
  }
  
  getMonthlyTotalPages(): number {
    return Math.ceil(this.getFilteredMonthlySummary().length / this.monthlyItemsPerPage);
  }
  
  getMonthlyPageNumbers(): number[] {
    const totalPages = this.getMonthlyTotalPages();
    const pages: number[] = [];
    const maxPages = 5;
    
    if (totalPages <= maxPages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (this.monthlyCurrentPage <= 3) {
        for (let i = 1; i <= maxPages; i++) {
          pages.push(i);
        }
      } else if (this.monthlyCurrentPage >= totalPages - 2) {
        for (let i = totalPages - maxPages + 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        for (let i = this.monthlyCurrentPage - 2; i <= this.monthlyCurrentPage + 2; i++) {
          pages.push(i);
        }
      }
    }
    
    return pages;
  }
  
  goToMonthlyPage(page: number) {
    this.monthlyCurrentPage = page;
    this.cdr.markForCheck();
  }
  
  previousMonthlyPage() {
    if (this.monthlyCurrentPage > 1) {
      this.monthlyCurrentPage--;
      this.cdr.markForCheck();
    }
  }
  
  nextMonthlyPage() {
    if (this.monthlyCurrentPage < this.getMonthlyTotalPages()) {
      this.monthlyCurrentPage++;
      this.cdr.markForCheck();
    }
  }
  
  // Daily Summary Pagination Methods
  getPaginatedDailySummary() {
    const filtered = this.getFilteredDailySummary();
    const totalPages = Math.ceil(filtered.length / this.dailyItemsPerPage);
    
    if (this.dailyCurrentPage > totalPages && totalPages > 0) {
      this.dailyCurrentPage = totalPages;
    } else if (this.dailyCurrentPage < 1) {
      this.dailyCurrentPage = 1;
    }
    
    const startIndex = (this.dailyCurrentPage - 1) * this.dailyItemsPerPage;
    return filtered.slice(startIndex, startIndex + this.dailyItemsPerPage);
  }
  
  getDailyTotalPages(): number {
    return Math.ceil(this.getFilteredDailySummary().length / this.dailyItemsPerPage);
  }
  
  getDailyPageNumbers(): number[] {
    const totalPages = this.getDailyTotalPages();
    const pages: number[] = [];
    const maxPages = 5;
    
    if (totalPages <= maxPages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (this.dailyCurrentPage <= 3) {
        for (let i = 1; i <= maxPages; i++) {
          pages.push(i);
        }
      } else if (this.dailyCurrentPage >= totalPages - 2) {
        for (let i = totalPages - maxPages + 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        for (let i = this.dailyCurrentPage - 2; i <= this.dailyCurrentPage + 2; i++) {
          pages.push(i);
        }
      }
    }
    
    return pages;
  }
  
  goToDailyPage(page: number) {
    this.dailyCurrentPage = page;
    this.cdr.markForCheck();
  }
  
  previousDailyPage() {
    if (this.dailyCurrentPage > 1) {
      this.dailyCurrentPage--;
      this.cdr.markForCheck();
    }
  }
  
  nextDailyPage() {
    if (this.dailyCurrentPage < this.getDailyTotalPages()) {
      this.dailyCurrentPage++;
      this.cdr.markForCheck();
    }
  }

  // Get total pages
  getTotalPages(): number {
    return Math.ceil(this.getFilteredTrades().length / this.itemsPerPage);
  }

  getStartIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage;
  }

  getEndIndex(): number {
    const filteredTrades = this.getFilteredTrades();
    return Math.min(this.currentPage * this.itemsPerPage, filteredTrades.length);
  }

  // Pagination methods
  goToPage(page: number) {
    const totalPages = this.getTotalPages();
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.cdr.markForCheck();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.cdr.markForCheck();
    }
  }

  nextPage() {
    if (this.currentPage < this.getTotalPages()) {
      this.currentPage++;
      this.cdr.markForCheck();
    }
  }

  // Get page numbers for pagination
  getPageNumbers(): number[] {
    const totalPages = this.getTotalPages();
    const pages: number[] = [];
    const maxPages = 5;
    
    if (totalPages <= maxPages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (this.currentPage <= 3) {
        for (let i = 1; i <= maxPages; i++) {
          pages.push(i);
        }
      } else if (this.currentPage >= totalPages - 2) {
        for (let i = totalPages - maxPages + 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        for (let i = this.currentPage - 2; i <= this.currentPage + 2; i++) {
          pages.push(i);
        }
      }
    }
    
    return pages;
  }

  // Statistics (cached for performance)
  private getCachedStatistics() {
    if (this._cachedStatistics) {
      return this._cachedStatistics;
    }
    
    let profitCount = 0;
    let lossCount = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    
    for (const trade of this.trades) {
      if (trade.isProfit === true) {
        profitCount++;
        totalProfit += trade.amount || 0;
      } else {
        lossCount++;
        totalLoss += trade.amount || 0;
      }
    }
    
    this._cachedStatistics = {
      profitCount,
      lossCount,
      totalProfit,
      totalLoss,
      netPnl: totalProfit - totalLoss
    };
    
    return this._cachedStatistics;
  }

  getTotalProfitCount(): number {
    return this.getCachedStatistics().profitCount;
  }

  getTotalLossCount(): number {
    return this.getCachedStatistics().lossCount;
  }

  getTotalProfitAmount(): number {
    return this.getCachedStatistics().totalProfit;
  }

  getTotalLossAmount(): number {
    return this.getCachedStatistics().totalLoss;
  }

  getNetProfitLoss(): number {
    return this.getCachedStatistics().netPnl;
  }


  getProfitLossBySymbol(): { [symbol: string]: { profit: number; loss: number } } {
    return this.tradingService.getProfitLossBySymbol(this.trades);
  }

  // Get daily summary - net profit/loss per day (cached for performance)
  getDailySummary(): Array<{
    date: string;
    totalTrades: number;
    profitCount: number;
    lossCount: number;
    totalProfit: number;
    totalLoss: number;
    netPnl: number;
  }> {
    // Return cached result if trades haven't changed
    // Check if cache is valid by comparing total trade count
    const cachedTotalTrades = this._cachedDailySummary.reduce((sum, day) => sum + day.totalTrades, 0);
    if (this._cachedDailySummary.length > 0 && this.trades.length === cachedTotalTrades && cachedTotalTrades > 0) {
      return this._cachedDailySummary;
    }
    
    const dailyMap = new Map<string, {
      totalTrades: number;
      profitCount: number;
      lossCount: number;
      totalProfit: number;
      totalLoss: number;
    }>();

    // Group trades by date
    for (const trade of this.trades) {
      const date = trade.date;
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          totalTrades: 0,
          profitCount: 0,
          lossCount: 0,
          totalProfit: 0,
          totalLoss: 0
        });
      }

      const dayData = dailyMap.get(date)!;
      dayData.totalTrades++;

      if (trade.isProfit === true) {
        dayData.profitCount++;
        dayData.totalProfit += trade.amount || 0;
      } else {
        dayData.lossCount++;
        dayData.totalLoss += trade.amount || 0;
      }
    }

    // Convert to array and calculate net P&L
    const summary = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      ...data,
      netPnl: data.totalProfit - data.totalLoss
    }));

    // Sort by date descending (most recent first)
    summary.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    // Cache the result
    this._cachedDailySummary = summary;
    
    return summary;
  }

  // Get filtered daily summary (based on current filters)
  getFilteredDailySummary(): Array<{
    date: string;
    totalTrades: number;
    profitCount: number;
    lossCount: number;
    totalProfit: number;
    totalLoss: number;
    netPnl: number;
  }> {
    const filteredTrades = this.getFilteredTrades();
    const dailyMap = new Map<string, {
      totalTrades: number;
      profitCount: number;
      lossCount: number;
      totalProfit: number;
      totalLoss: number;
    }>();

    // Group filtered trades by date
    for (const trade of filteredTrades) {
      const date = trade.date;
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          totalTrades: 0,
          profitCount: 0,
          lossCount: 0,
          totalProfit: 0,
          totalLoss: 0
        });
      }

      const dayData = dailyMap.get(date)!;
      dayData.totalTrades++;

      if (trade.isProfit === true) {
        dayData.profitCount++;
        dayData.totalProfit += trade.amount || 0;
      } else {
        dayData.lossCount++;
        dayData.totalLoss += trade.amount || 0;
      }
    }

    // Convert to array and calculate net P&L
    const summary = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      ...data,
      netPnl: data.totalProfit - data.totalLoss
    }));

    // Sort by date descending (most recent first)
    summary.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    return summary;
  }

  // Check if add trade form is valid
  isAddTradeFormValid(): boolean {
    const indexValue = parseFloat(this.indexValueInput) || 0;
    const amount = parseFloat(this.amountInput) || 0;
    
    return !!(
      this.newTrade.symbol &&
      this.newTrade.symbol.trim() !== '' &&
      this.newTrade.tradeType &&
      (this.newTrade.tradeType === 'call' || this.newTrade.tradeType === 'put') &&
      this.newTrade.isProfit !== undefined &&
      this.newTrade.isProfit !== null &&
      indexValue > 0 &&
      amount > 0 &&
      this.newTrade.date
    );
  }

  // Format currency
  formatCurrency(amount: number): string {
    const absoluteAmount = Math.abs(amount);
    return `₹${Math.round(absoluteAmount).toLocaleString('en-IN')}`;
  }

  // Format percentage
  formatPercentage(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  // Format date as "20 Jan 2026"
  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  // Get profit/loss color class
  getProfitLossClass(value: number | undefined): string {
    if (value === undefined || value === null) return '';
    return value >= 0 ? 'profit' : 'loss';
  }

  // Show daily summary trades in modal
  async showDailyTrades(date: string) {
    const trades = this.getFilteredTrades()
      .filter(trade => trade.date === date)
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        if (dateA !== dateB) {
          return dateB - dateA;
        }

        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

        if (createdA !== createdB) {
          return createdB - createdA;
        }

        return b.id.localeCompare(a.id);
      });
    const daySummary = this.getFilteredDailySummary().find(day => day.date === date);
    
    if (!daySummary) return;

    const tradesData = trades.map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      indexValue: trade.indexValue || 0,
      tradeType: trade.tradeType || 'call',
      isProfit: trade.isProfit !== undefined ? trade.isProfit : true,
      amount: trade.amount || 0,
      date: trade.date,
      notes: trade.notes
    }));

    const title = `${date} - ${daySummary.totalTrades} trade${daySummary.totalTrades !== 1 ? 's' : ''}`;
    const message = `Net P&L: ${this.formatCurrency(daySummary.netPnl)}`;
    
    await this.dialogService.showTradeList(tradesData, title, message, daySummary.netPnl);
  }

  // Get trades for a specific date
  getTradesByDate(date: string): Trade[] {
    return this.getFilteredTrades().filter(trade => trade.date === date);
  }

  // TrackBy function for *ngFor loops to improve performance
  trackByTradeId(index: number, trade: Trade): string {
    return trade.id;
  }

  trackByDate(index: number, day: { date: string }): string {
    return day.date;
  }
  
  trackByMonthYear(index: number, month: { month: string; year: number }): string {
    return `${month.month}-${month.year}`;
  }
  
  // Monthly Summary Methods
  getMonthlySummary(): Array<{
    month: string;
    year: number;
    monthYear: string;
    totalTrades: number;
    profitCount: number;
    lossCount: number;
    totalProfit: number;
    totalLoss: number;
    netPnl: number;
    averageProfitLoss: number;
  }> {
    const monthlyMap = new Map<string, {
      month: string;
      year: number;
      totalTrades: number;
      profitCount: number;
      lossCount: number;
      totalProfit: number;
      totalLoss: number;
    }>();

    // Group trades by month and year
    for (const trade of this.trades) {
      const tradeDate = new Date(trade.date);
      const month = tradeDate.getMonth();
      const year = tradeDate.getFullYear();
      const monthKey = `${year}-${month}`;
      const monthName = tradeDate.toLocaleDateString('en-US', { month: 'long' });

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthName,
          year: year,
          totalTrades: 0,
          profitCount: 0,
          lossCount: 0,
          totalProfit: 0,
          totalLoss: 0
        });
      }

      const monthData = monthlyMap.get(monthKey)!;
      monthData.totalTrades++;

      if (trade.isProfit === true) {
        monthData.profitCount++;
        monthData.totalProfit += trade.amount || 0;
      } else {
        monthData.lossCount++;
        monthData.totalLoss += trade.amount || 0;
      }
    }

    // Convert to array and calculate net P&L and average
    const summary = Array.from(monthlyMap.entries()).map(([monthKey, data]) => {
      const netPnl = data.totalProfit - data.totalLoss;
      const averageProfitLoss = data.totalTrades > 0 ? netPnl / data.totalTrades : 0;
      // Extract month index from monthKey (format: "year-month")
      const monthIndex = parseInt(monthKey.split('-')[1]);
      
      return {
        ...data,
        monthYear: `${data.month} ${data.year}`,
        netPnl: netPnl,
        averageProfitLoss: averageProfitLoss,
        monthIndex: monthIndex // Store for sorting
      };
    });

    // Sort by year and month descending (most recent first)
    summary.sort((a: any, b: any) => {
      if (a.year !== b.year) {
        return b.year - a.year;
      }
      // Use stored monthIndex for comparison
      return b.monthIndex - a.monthIndex;
    });

    // Remove monthIndex from final result
    return summary.map(({ monthIndex, ...rest }) => rest);
  }
  
  // Get filtered monthly summary (based on current filters)
  getFilteredMonthlySummary(): Array<{
    month: string;
    year: number;
    monthYear: string;
    totalTrades: number;
    profitCount: number;
    lossCount: number;
    totalProfit: number;
    totalLoss: number;
    netPnl: number;
    averageProfitLoss: number;
  }> {
    const filteredTrades = this.getFilteredTrades();
    const monthlyMap = new Map<string, {
      month: string;
      year: number;
      totalTrades: number;
      profitCount: number;
      lossCount: number;
      totalProfit: number;
      totalLoss: number;
    }>();

    // Group filtered trades by month and year
    for (const trade of filteredTrades) {
      const tradeDate = new Date(trade.date);
      const month = tradeDate.getMonth();
      const year = tradeDate.getFullYear();
      const monthKey = `${year}-${month}`;
      const monthName = tradeDate.toLocaleDateString('en-US', { month: 'long' });

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthName,
          year: year,
          totalTrades: 0,
          profitCount: 0,
          lossCount: 0,
          totalProfit: 0,
          totalLoss: 0
        });
      }

      const monthData = monthlyMap.get(monthKey)!;
      monthData.totalTrades++;

      if (trade.isProfit === true) {
        monthData.profitCount++;
        monthData.totalProfit += trade.amount || 0;
      } else {
        monthData.lossCount++;
        monthData.totalLoss += trade.amount || 0;
      }
    }

    // Convert to array and calculate net P&L and average
    const summary = Array.from(monthlyMap.entries()).map(([monthKey, data]) => {
      const netPnl = data.totalProfit - data.totalLoss;
      const averageProfitLoss = data.totalTrades > 0 ? netPnl / data.totalTrades : 0;
      // Extract month index from monthKey (format: "year-month")
      const monthIndex = parseInt(monthKey.split('-')[1]);
      
      return {
        ...data,
        monthYear: `${data.month} ${data.year}`,
        netPnl: netPnl,
        averageProfitLoss: averageProfitLoss,
        monthIndex: monthIndex // Store for sorting
      };
    });

    // Sort by year and month descending (most recent first)
    summary.sort((a: any, b: any) => {
      if (a.year !== b.year) {
        return b.year - a.year;
      }
      // Use stored monthIndex for comparison
      return b.monthIndex - a.monthIndex;
    });

    // Remove monthIndex from final result
    return summary.map(({ monthIndex, ...rest }) => rest);
  }
  
  // Get trades for a specific month
  getTradesByMonth(month: string, year: number): Trade[] {
    return this.trades.filter(trade => {
      const tradeDate = new Date(trade.date);
      return tradeDate.getMonth() === this.availableMonths.findIndex(m => m.label === month) &&
             tradeDate.getFullYear() === year;
    });
  }
  
  // Show monthly trades in modal
  async showMonthlyTrades(month: string, year: number) {
    // Sort trades so the most recent (including time) appear first
    const trades = this.getTradesByMonth(month, year).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (dateA !== dateB) {
        return dateB - dateA; // Newer date first
      }

      // If same day, use createdAt timestamp when available
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      if (createdA !== createdB) {
        return createdB - createdA; // Newer createdAt first
      }

      // Final tie-breaker: id descending (more recent IDs usually sort last)
      return b.id.localeCompare(a.id);
    });
    const monthSummary = this.getMonthlySummary().find(s => s.month === month && s.year === year);
    
    if (!monthSummary) return;

    const tradesData = trades.map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      indexValue: trade.indexValue || 0,
      tradeType: trade.tradeType || 'call',
      isProfit: trade.isProfit !== undefined ? trade.isProfit : true,
      amount: trade.amount || 0,
      date: trade.date,
      notes: trade.notes
    }));

    const title = `${month} ${year} - ${monthSummary.totalTrades} trade${monthSummary.totalTrades !== 1 ? 's' : ''}`;
    const message = `Net P&L: ${this.formatCurrency(monthSummary.netPnl)} | Avg P&L: ${this.formatCurrency(monthSummary.averageProfitLoss)}`;
    
    await this.dialogService.showTradeList(tradesData, title, message, monthSummary.netPnl);
  }
  
  // Toggle monthly summary section
  toggleMonthlySummarySection() {
    this.isMonthlySummaryExpanded = !this.isMonthlySummaryExpanded;
  }

  // Chart methods
  toggleCharts() {
    this.showCharts = !this.showCharts;
    if (this.showCharts) {
      this.generateChartData();
    }
    this.cdr.markForCheck();
  }

  generateChartData() {
    if (this.trades.length === 0) {
      this.monthlyPnlChartData = null;
      this.profitLossPieChartData = null;
      this.tradeTypeChartData = null;
      return;
    }

    // 1. Monthly P&L Trend (Line Chart)
    this.generateMonthlyPnlChart();
    
    // 2. Profit vs Loss Pie Chart
    this.generateProfitLossPieChart();
    
    // 3. Trade Type Distribution (Doughnut Chart)
    this.generateTradeTypeChart();
  }

  generateMonthlyPnlChart() {
    const monthlyData = this.getMonthlySummary();
    const sortedData = [...monthlyData].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });

    const labels = sortedData.map(m => `${m.month.substring(0, 3)} ${m.year}`);
    const netPnl = sortedData.map(m => m.netPnl);

    this.monthlyPnlChartData = {
      labels: labels,
      datasets: [{
        label: 'Net P&L',
        data: netPnl,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: (ctx: any) => {
          const value = ctx.parsed.y;
          return value >= 0 ? '#10b981' : '#ef4444';
        },
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    };
  }

  generateProfitLossPieChart() {
    const totalProfit = this.trades
      .filter(t => t.isProfit === true)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const totalLoss = this.trades
      .filter(t => t.isProfit === false)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    if (totalProfit === 0 && totalLoss === 0) {
      this.profitLossPieChartData = null;
      return;
    }

    this.profitLossPieChartData = {
      labels: ['Total Profit', 'Total Loss'],
      datasets: [{
        data: [totalProfit, totalLoss],
        backgroundColor: ['#10b981', '#ef4444'],
        borderColor: ['#059669', '#dc2626'],
        borderWidth: 2,
        hoverOffset: 4
      }]
    };
  }

  generateTradeTypeChart() {
    const callCount = this.trades.filter(t => t.tradeType === 'call').length;
    const putCount = this.trades.filter(t => t.tradeType === 'put').length;

    if (callCount === 0 && putCount === 0) {
      this.tradeTypeChartData = null;
      return;
    }

    this.tradeTypeChartData = {
      labels: ['Call', 'Put'],
      datasets: [{
        data: [callCount, putCount],
        backgroundColor: ['#3b82f6', '#f59e0b'],
        borderColor: ['#2563eb', '#d97706'],
        borderWidth: 2,
        hoverOffset: 4
      }]
    };
  }

  getMonthlyPnlChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed.y;
              const sign = value >= 0 ? '+' : '';
              return `Net P&L: ${sign}₹${Math.abs(value).toLocaleString('en-IN')}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (value: any) => {
              return `₹${Number(value).toLocaleString('en-IN')}`;
            }
          },
          grid: {
            color: (context: any) => {
              return context.tick.value === 0 ? '#ef4444' : '#e5e7eb';
            }
          }
        }
      }
    };
  }

  getPieChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';
              const value = context.parsed;
              return `${label}: ₹${value.toLocaleString('en-IN')}`;
            }
          }
        }
      }
    };
  }

  getDoughnutChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} trades (${percentage}%)`;
            }
          }
        }
      }
    };
  }
}
