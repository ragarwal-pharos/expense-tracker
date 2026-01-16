import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradingService } from '../../core/services/trading.service';
import { FirebaseService } from '../../core/services/firebase.service';
import { DialogService } from '../../core/services/dialog.service';
import { LoadingComponent } from '../../shared/components/loading/loading.component';
import { Subscription, combineLatest } from 'rxjs';
import { Trade } from '../../core/models/trade.model';

@Component({
  selector: 'app-trading',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingComponent],
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

  // Pagination properties
  currentPage: number = 1;
  itemsPerPage: number = 10;

  // Loading states
  isLoading: boolean = true;
  isSaving: boolean = false;
  isDeleting: boolean = false;
  deletingTradeIds: Set<string> = new Set();

  // Expand/Collapse states
  isAddTradeExpanded: boolean = true;
  isFiltersExpanded: boolean = true;
  isTradesListExpanded: boolean = true;

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
    
    // Ensure trades are loaded and real-time listener is set up
    this.firebaseService.loadTrades().then(() => {
      console.log('Trades loaded initially');
      // Real-time listener will handle updates
    }).catch(error => {
      console.error('Error loading trades:', error);
    });
    
    // Subscribe to Firebase observables for real-time updates
    this.subscription.add(
      this.firebaseService.trades$.subscribe((trades) => {
        console.log('Trades updated in component:', trades.length, trades);
        this.trades = [...trades]; // Create new array reference to trigger change detection
        // Clear caches when data changes
        this._cachedFilteredTrades = [];
        this._cachedFilteredTradesKey = '';
        this._cachedDailySummary = [];
        this._cachedStatistics = null;
        // Force change detection to update statistics and list
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
    this.currentPage = 1; // Reset to first page
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
      this.sortBy !== 'date' ||
      this.sortOrder !== 'desc'
    );
  }

  // Add new trade
  async addTrade() {
    if (!this.validateTrade()) {
      return;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    try {
      const amount = parseFloat(this.amountInput) || 0;
      const indexValue = parseFloat(this.indexValueInput) || 0;
      
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

      console.log('Form isProfit value:', this.newTrade.isProfit, 'Type:', typeof this.newTrade.isProfit);
      console.log('Saving isProfit as:', isProfit, 'Type:', typeof isProfit);
      
      const tradeId = await this.tradingService.add(tradeData);
      console.log('Trade added with ID:', tradeId);
      console.log('Trade data saved:', tradeData);
      
      // Force reload trades to ensure UI updates immediately
      await this.firebaseService.loadTrades();
      
      await this.dialogService.success('Trade added successfully!');
      
      this.resetForm();
      
      // Force change detection after a short delay to ensure Firebase listener has updated
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 100);
    } catch (error) {
      console.error('Error adding trade:', error);
      await this.dialogService.error('Error adding trade. Please try again.');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  // Validate trade
  validateTrade(): boolean {
    if (!this.newTrade.symbol || this.newTrade.symbol.trim() === '') {
      this.dialogService.error('Please select an index.');
      return false;
    }

    const indexValue = parseFloat(this.indexValueInput);
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

    const amount = parseFloat(this.amountInput);
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
      await this.dialogService.success('Trade updated successfully!');
    } catch (error) {
      console.error('Error updating trade:', error);
      await this.dialogService.error('Error updating trade. Please try again.');
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
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
        await this.tradingService.delete(trade.id);
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
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return filtered.slice(startIndex, startIndex + this.itemsPerPage);
  }

  // Get total pages
  getTotalPages(): number {
    return Math.ceil(this.getFilteredTrades().length / this.itemsPerPage);
  }

  // Pagination methods
  goToPage(page: number) {
    this.currentPage = page;
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.getTotalPages()) {
      this.currentPage++;
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
    if (this._cachedDailySummary.length > 0 && this.trades.length === this._cachedDailySummary.reduce((sum, day) => sum + day.totalTrades, 0)) {
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
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  }

  // Format percentage
  formatPercentage(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  // Get profit/loss color class
  getProfitLossClass(value: number | undefined): string {
    if (value === undefined || value === null) return '';
    return value >= 0 ? 'profit' : 'loss';
  }

  // Show daily summary trades in modal
  async showDailyTrades(date: string) {
    const trades = this.getFilteredTrades().filter(trade => trade.date === date);
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
}
