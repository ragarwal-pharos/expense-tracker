import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { FirebaseService } from '../../core/services/firebase.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { DialogService } from '../../core/services/dialog.service';
import { ActionHistoryService } from '../../core/services/action-history.service';
import { LoadingComponent } from '../../shared/components/loading/loading.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { Subscription, combineLatest } from 'rxjs';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingComponent, SkeletonComponent],
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
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

  // Separate property for amount input (string)
  amountInput: string = '';

  // Filter properties
  globalSearch: string = '';
  filterAmount: string = '';
  filterCategory: string = '';
  filterDate: string = '';
  filterDateFrom: string = '';
  filterDateTo: string = '';
  sortBy: 'date' | 'amount' = 'date';
  sortOrder: 'asc' | 'desc' = 'desc';
  
  // Dashboard filter state properties
  dashboardPeriod: string = 'all';
  dashboardMonth: string = '';
  dashboardYear: string = '';
  dashboardStartDate: string = '';
  dashboardEndDate: string = '';
  dashboardMonthOnly: string = '';
  dashboardYearOnly: string = '';

  // Edit mode properties
  isEditMode: boolean = false;
  editingExpenseId: string = '';

  // Pagination properties
  currentPage: number = 1;
  itemsPerPage: number = 10;

  // Loading states
  isLoading: boolean = true;
  isSaving: boolean = false;
  isDeleting: boolean = false;
  deletingExpenseIds: Set<string> = new Set(); // Track which expenses are being deleted
  isEditing: boolean = false;
  isFiltering: boolean = false;
  isGeneratingPDF: boolean = false;
  isPrinting: boolean = false;

  // Expand/Collapse states
  isAddExpenseExpanded: boolean = true;
  isFiltersExpanded: boolean = true;
  isExpensesListExpanded: boolean = true;
  
  // Search focus state
  isSearchFocused: boolean = false;

  // Category suggestions
  categorySuggestions: Category[] = [];
  showSuggestions: boolean = false;

  // Bulk selection properties
  bulkSelectionMode: boolean = false;
  selectedExpenseIds: Set<string> = new Set();
  isBulkDeleting: boolean = false;

  private subscription: Subscription = new Subscription();
  private categoryMap: Map<string, Category> = new Map();

  // Action history and undo
  lastDeletedExpense: Expense | null = null;
  lastUpdatedExpense: Expense | null = null;
  deletedExpenseIds: Set<string> = new Set(); // Track expenses marked for deletion
  deletedExpensesData: Map<string, Expense> = new Map(); // Store expense data for undo
  expenseUndoTimeouts: Map<string, any> = new Map(); // Track timeouts per expense

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private firebaseService: FirebaseService,
    private filterStateService: FilterStateService,
    private dialogService: DialogService,
    private actionHistoryService: ActionHistoryService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Check for edit mode and category filter from query parameters
    this.route.queryParams.subscribe(params => {
      const editId = params['edit'];
      const mode = params['mode'];
      const categoryFilter = params['category'];
      const filterType = params['filter'];
      
      if (editId && mode === 'edit') {
        this.isEditMode = true;
        this.editingExpenseId = editId;
      }
      
      // Handle category filter from dashboard
      if (categoryFilter && filterType === 'category') {
        this.filterCategory = categoryFilter;
      }
    });

    // Always load dashboard filter state from FilterStateService, regardless of navigation method
    this.loadDashboardFilterState();
    
    // Subscribe to filter state changes
    this.subscription.add(
      this.filterStateService.filterState$.subscribe(filterState => {
        this.loadDashboardFilterState();
      })
    );

    // Subscribe to Firebase observables for real-time updates using combineLatest for efficiency
    this.subscription.add(
      combineLatest([
        this.firebaseService.expenses$,
        this.firebaseService.categories$
      ]).subscribe(([expenses, categories]) => {
        // Merge deleted expenses back into the list temporarily for undo functionality
        const deletedExpensesToKeep: Expense[] = [];
        this.deletedExpenseIds.forEach(expenseId => {
          const deletedExpense = this.deletedExpensesData.get(expenseId);
          if (deletedExpense) {
            deletedExpensesToKeep.push(deletedExpense);
          }
        });
        
        // Combine Firebase expenses with temporarily deleted expenses
        this.expenses = [...expenses, ...deletedExpensesToKeep];
        
        // Build category map for O(1) lookups
        this.categories = categories;
        this.categoryMap.clear();
        this.categories.forEach(cat => this.categoryMap.set(cat.id, cat));
        
        // Log orphaned expenses details
        this.logOrphanedExpensesDetails();
        
        // If in edit mode, load the expense for editing
        if (this.isEditMode && this.editingExpenseId) {
          this.loadExpenseForEditing();
        }
        
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

    // Firebase observables will automatically load data when user is authenticated
    // No need for manual loadData() call as it creates redundant API requests
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  // Load dashboard filter state from FilterStateService
  private loadDashboardFilterState() {
    const filterState = this.filterStateService.getFilterState();
    
    this.dashboardPeriod = filterState.selectedPeriod;
    this.dashboardMonth = filterState.selectedMonth;
    this.dashboardYear = filterState.selectedYear;
    this.dashboardStartDate = filterState.customStartDate;
    this.dashboardEndDate = filterState.customEndDate;
    this.dashboardMonthOnly = filterState.selectedMonthOnly || '';
    this.dashboardYearOnly = filterState.selectedYearOnly || '';
    
    // Populate expenses page date filters with dashboard date range
    if (this.dashboardPeriod === 'custom' && this.dashboardStartDate && this.dashboardEndDate) {
      this.filterDateFrom = this.dashboardStartDate;
      this.filterDateTo = this.dashboardEndDate;
    } else if (this.dashboardPeriod === 'monthly' && this.dashboardMonth && this.dashboardYear) {
      const monthIndex = parseInt(this.dashboardMonth);
      const year = parseInt(this.dashboardYear);
      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0);
      this.filterDateFrom = startDate.toISOString().split('T')[0];
      this.filterDateTo = endDate.toISOString().split('T')[0];
    } else if (this.dashboardPeriod === 'yearly' && this.dashboardYear) {
      const year = parseInt(this.dashboardYear);
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      this.filterDateFrom = startDate.toISOString().split('T')[0];
      this.filterDateTo = endDate.toISOString().split('T')[0];
    } else if (this.dashboardPeriod === 'last30') {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);
      this.filterDateFrom = startDate.toISOString().split('T')[0];
      this.filterDateTo = endDate.toISOString().split('T')[0];
    } else if (this.dashboardPeriod === 'last7') {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);
      this.filterDateFrom = startDate.toISOString().split('T')[0];
      this.filterDateTo = endDate.toISOString().split('T')[0];
    } else if (this.dashboardPeriod === 'monthOnly' && this.dashboardMonthOnly && this.dashboardYearOnly) {
      const monthIndex = parseInt(this.dashboardMonthOnly);
      const year = parseInt(this.dashboardYearOnly);
      const startDate = new Date(Date.UTC(year, monthIndex, 1));
      const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
      this.filterDateFrom = startDate.toISOString().split('T')[0];
      this.filterDateTo = endDate.toISOString().split('T')[0];
    }
  }

  // loadData() method removed - Firebase observables handle data loading automatically

  loadExpenseForEditing() {
    const expense = this.expenses.find(e => e.id === this.editingExpenseId);
    if (expense) {
      this.newExpense = { ...expense };
      this.amountInput = expense.amount.toString();
      
      // Check if category is valid when loading for editing
      const categoryValidation = this.validateCategoryExists(expense.categoryId);
      if (!categoryValidation.exists) {
        console.warn('Expense has invalid category:', expense.categoryId);
        // Category will be validated when user tries to save
      }
      
    } else {
      console.error('Expense not found for editing:', this.editingExpenseId);
      // Clear edit mode if expense not found
      this.isEditMode = false;
      this.editingExpenseId = '';
    }
  }

  async addExpense() {
    if (!(await this.validateExpense())) {
      return;
    }

    try {
      this.isSaving = true;
      this.cdr.markForCheck(); // Trigger change detection for OnPush
      if (this.isEditMode) {
        await this.saveExpenseChanges();
      } else {
        await this.createNewExpense();
      }
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck(); // Trigger change detection for OnPush to hide loader
    }
  }

  async createNewExpense() {
    try {
      const amount = parseFloat(this.amountInput);
      if (isNaN(amount) || amount <= 0) {
        await this.dialogService.warning('Please enter a valid amount greater than 0.');
        return;
      }

      // Final category validation before saving
      const categoryValidation = this.validateCategoryExists(this.newExpense.categoryId);
      if (!categoryValidation.exists) {
        if (categoryValidation.wasDeleted) {
          await this.dialogService.error(
            'The selected category no longer exists. It may have been deleted. Please select a different category.',
            'Category Deleted'
          );
        } else {
          await this.dialogService.error(
            'Invalid category selected. Please select a valid category from the list.',
            'Invalid Category'
          );
        }
        this.newExpense.categoryId = '';
        return;
      }

      const expenseData: Omit<Expense, 'id'> = {
        description: this.newExpense.description,
        amount: amount,
        date: this.newExpense.date,
        categoryId: this.newExpense.categoryId,
        paymentMethod: this.newExpense.paymentMethod || 'Cash',
        tags: this.newExpense.tags || [],
        priority: this.newExpense.priority || 'medium',
        notes: this.newExpense.notes || '',
        location: this.newExpense.location || '',
        receiptNumber: this.newExpense.receiptNumber || ''
        // createdAt will be set by Firebase service
      };

      const id = await this.expenseService.add(expenseData);
      
      this.resetForm();
      await this.dialogService.success('Expense added successfully!');
      
      // Check for achievements
      await this.checkAchievements();
    } catch (error) {
      console.error('Error adding expense:', error);
      await this.dialogService.error('Error adding expense. Please try again.');
    }
  }

  async saveExpenseChanges() {
    try {
      const amount = parseFloat(this.amountInput);
      if (isNaN(amount) || amount <= 0) {
        await this.dialogService.warning('Please enter a valid amount greater than 0.');
        return;
      }

      // Final category validation before saving
      const categoryValidation = this.validateCategoryExists(this.newExpense.categoryId);
      if (!categoryValidation.exists) {
        if (categoryValidation.wasDeleted) {
          await this.dialogService.error(
            'The selected category no longer exists. It may have been deleted. Please select a different category.',
            'Category Deleted'
          );
        } else {
          await this.dialogService.error(
            'Invalid category selected. Please select a valid category from the list.',
            'Invalid Category'
          );
        }
        // Don't clear category in edit mode, just show error
        return;
      }

      // Store original expense for undo
      const originalExpense = this.expenses.find(e => e.id === this.editingExpenseId);
      if (originalExpense) {
        this.lastUpdatedExpense = { ...originalExpense };
        this.actionHistoryService.addAction('update', originalExpense);
      }

      const updatedExpense: Expense = {
        ...this.newExpense,
        amount: amount
      };

      await this.expenseService.update(updatedExpense);
      
      // Exit edit mode
      this.isEditMode = false;
      this.editingExpenseId = '';
      this.resetForm();
      
      await this.dialogService.success('Expense updated successfully!');
      
      // Clear query parameters
      this.router.navigate(['/expenses']);
    } catch (error) {
      console.error('Error updating expense:', error);
      await this.dialogService.error('Error updating expense. Please try again.');
    }
  }

  async undoLastUpdate() {
    if (!this.lastUpdatedExpense) return;

    try {
      await this.expenseService.update(this.lastUpdatedExpense);
      this.lastUpdatedExpense = null;
      await this.dialogService.success('Expense update reverted successfully!');
    } catch (error) {
      console.error('Error undoing update:', error);
      await this.dialogService.error('Error reverting expense. Please try again.');
    }
  }

  cancelEdit() {
    // Exit edit mode
    this.isEditMode = false;
    this.editingExpenseId = '';
    this.resetForm();
    
    // Clear query parameters
    this.router.navigate(['/expenses']);
  }

  async editExpense(expense: Expense) {
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
      
      // Create category selection options
      const categoryOptions = this.categories.map(cat => ({
        value: cat.id,
        label: cat.name,
        icon: cat.icon
      }));
      
      // Get updated category
      const categorySelection = await this.dialogService.select(
        'Select a category:',
        'Edit Expense',
        categoryOptions,
        expense.categoryId
      );
      
      if (categorySelection === null) return; // User cancelled
      
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

      // Check if the selected date is in the future
      const selectedDate = new Date(dateStr);
      const today = new Date();
      
      // Reset both dates to start of day for accurate comparison
      selectedDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate > today) {
        await this.dialogService.error('Cannot edit expenses to future dates. Please select today\'s date or a past date.');
        return;
      }

      // Validate category
      const selectedCategory = this.categories.find(cat => cat.id === categorySelection);
      if (!selectedCategory) {
        await this.dialogService.error(`Error: Category with ID "${categorySelection}" does not exist. Please select a valid category from the list.`);
        return;
      }

      const updatedExpense: Expense = {
        ...expense,
        description,
        amount: amount,
        date: dateStr,
        categoryId: categorySelection
      };

      await this.expenseService.update(updatedExpense);
      
      // Show detailed success message
      const successMessage = `Expense updated successfully!\n\n` +
        `Description: ${description}\n` +
        `Amount: ₹${amount}\n` +
        `Date: ${dateStr}\n` +
        `Category: ${selectedCategory.icon} ${selectedCategory.name}`;
      
      await this.dialogService.success(successMessage);
      
    } catch (error) {
      console.error('Error editing expense:', error);
      await this.dialogService.error('Error updating expense. Please try again.');
    }
  }


  async deleteExpense(expense: Expense) {
    const confirmed = await this.dialogService.confirm(
      `Are you sure you want to delete "${expense.description}" (₹${expense.amount})?`,
      'Delete Expense'
    );
    if (!confirmed) return;

    // Mark this specific expense as being deleted
    this.deletingExpenseIds.add(expense.id);

    // Store expense for undo
    this.lastDeletedExpense = { ...expense };
    this.deletedExpensesData.set(expense.id, { ...expense }); // Store full expense data
    this.actionHistoryService.addAction('delete', expense);

    // Mark expense as deleted (show undo on tile)
    this.deletedExpenseIds.add(expense.id);
    
    // Set timeout to actually delete after 5 seconds
    const timeout = setTimeout(async () => {
      await this.finalizeDelete(expense.id);
    }, 5000);
    
    this.expenseUndoTimeouts.set(expense.id, timeout);
    
    // Trigger change detection for OnPush to show undo button immediately
    this.cdr.markForCheck();

    // Actually delete from backend
    try {
      await this.expenseService.delete(expense.id);
    } catch (error) {
      console.error('Error deleting expense:', error);
      // Remove from deleted set if deletion failed
      this.deletedExpenseIds.delete(expense.id);
      this.deletingExpenseIds.delete(expense.id);
      if (this.expenseUndoTimeouts.has(expense.id)) {
        clearTimeout(this.expenseUndoTimeouts.get(expense.id));
        this.expenseUndoTimeouts.delete(expense.id);
      }
      await this.dialogService.error('Error deleting expense. Please try again.');
      this.cdr.markForCheck();
    } finally {
      this.deletingExpenseIds.delete(expense.id);
      this.cdr.markForCheck();
    }
  }

  isExpenseBeingDeleted(expenseId: string): boolean {
    return this.deletingExpenseIds.has(expenseId);
  }

  async undoDelete(expenseId: string) {
    const expense = this.deletedExpensesData.get(expenseId);
    if (!expense) return;

    // Clear timeout
    if (this.expenseUndoTimeouts.has(expenseId)) {
      clearTimeout(this.expenseUndoTimeouts.get(expenseId));
      this.expenseUndoTimeouts.delete(expenseId);
    }

    // Remove from deleted set
    this.deletedExpenseIds.delete(expenseId);
    this.deletedExpensesData.delete(expenseId);

    try {
      // Recreate the expense
      const { id, ...expenseData } = expense;
      await this.expenseService.add(expenseData);
      await this.dialogService.success('Expense restored successfully!');
      // Trigger change detection for OnPush to update UI
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error undoing delete:', error);
      await this.dialogService.error('Error restoring expense. Please try again.');
      this.cdr.markForCheck();
    }
  }

  async finalizeDelete(expenseId: string) {
    // Remove from deleted set and clear timeout
    this.deletedExpenseIds.delete(expenseId);
    this.deletedExpensesData.delete(expenseId);
    this.expenseUndoTimeouts.delete(expenseId);
    
    // Remove the expense from the local expenses array if it still exists
    // (it should already be removed by Firebase, but we ensure it's gone)
    this.expenses = this.expenses.filter(e => e.id !== expenseId);
    
    // Expense is already deleted from backend, just remove from local state
    // The real-time listener will handle the removal, but we ensure it's gone immediately
    
    // Trigger change detection for OnPush to update UI and remove undo button
    this.cdr.markForCheck();
  }

  isExpenseDeleted(expenseId: string): boolean {
    return this.deletedExpenseIds.has(expenseId);
  }

  // Export Functions
  generateShareableReport(expenses: Expense[]): string {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const dateRange = this.getDateRangeText();
    
    let report = `📊 Expense Report\n`;
    report += `═══════════════════════════════════\n\n`;
    report += `Period: ${dateRange}\n`;
    report += `Total Expenses: ${expenses.length}\n`;
    report += `Total Amount: ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
    report += `═══════════════════════════════════\n\n`;

    // Group by category
    const categoryTotals: { [key: string]: { total: number; count: number; expenses: Expense[] } } = {};
    expenses.forEach(expense => {
      const categoryName = this.getCategoryName(expense.categoryId) || 'Uncategorized';
      if (!categoryTotals[categoryName]) {
        categoryTotals[categoryName] = { total: 0, count: 0, expenses: [] };
      }
      categoryTotals[categoryName].total += expense.amount;
      categoryTotals[categoryName].count++;
      categoryTotals[categoryName].expenses.push(expense);
    });

    // Category summary
    report += `📋 Category Summary:\n`;
    Object.keys(categoryTotals).sort((a, b) => categoryTotals[b].total - categoryTotals[a].total).forEach(category => {
      const data = categoryTotals[category];
      const percentage = total > 0 ? ((data.total / total) * 100).toFixed(1) : '0.0';
      report += `  • ${category}: ₹${data.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${data.count} items, ${percentage}%)\n`;
    });

    report += `\n═══════════════════════════════════\n\n`;
    report += `📝 Expense Details:\n\n`;

    // Expense list
    expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach((expense, index) => {
      const categoryName = this.getCategoryName(expense.categoryId) || 'Uncategorized';
      const date = new Date(expense.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      report += `${index + 1}. ${expense.description || 'No description'}\n`;
      report += `   Date: ${date} | Amount: ₹${expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Category: ${categoryName}\n`;
      if (expense.notes) {
        report += `   Notes: ${expense.notes}\n`;
      }
      report += `\n`;
    });

    report += `═══════════════════════════════════\n`;
    report += `Generated on: ${new Date().toLocaleString('en-IN')}\n`;

    return report;
  }

  getDateRangeText(): string {
    if (this.filterDateFrom && this.filterDateTo) {
      return `${this.filterDateFrom} to ${this.filterDateTo}`;
    } else if (this.filterDateFrom) {
      return `From ${this.filterDateFrom}`;
    } else if (this.filterDateTo) {
      return `Until ${this.filterDateTo}`;
    } else if (this.filterDate) {
      return this.filterDate;
    } else if (this.filterCategory) {
      return `Category: ${this.getCategoryName(this.filterCategory)}`;
    }
    return 'All Time';
  }

  async exportToPDF() {
    const filteredExpenses = this.getFilteredExpenses();
    if (filteredExpenses.length === 0) {
      await this.dialogService.warning('No expenses to export. Please adjust your filters.');
      return;
    }

    if (this.isGeneratingPDF) {
      return; // Prevent multiple clicks
    }

    this.isGeneratingPDF = true;
    this.cdr.markForCheck(); // Trigger change detection for OnPush
    
    try {
      // Create HTML content for PDF
      const htmlContent = this.generatePDFHTML(filteredExpenses);
      
      // Create a temporary container in current window
      const tempContainer = document.createElement('div');
      tempContainer.id = 'pdf-export-container';
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '794px';
      tempContainer.style.background = 'white';
      tempContainer.style.zIndex = '-1';
      tempContainer.style.padding = '20px';
      tempContainer.style.visibility = 'visible';
      tempContainer.style.opacity = '1';
      document.body.appendChild(tempContainer);
      
      // Parse and inject HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const bodyContent = doc.body;
      const styles = doc.head.querySelectorAll('style');
      
      // Add styles to head
      styles.forEach(style => {
        const styleElement = document.createElement('style');
        styleElement.textContent = style.textContent || '';
        document.head.appendChild(styleElement);
      });
      
      // Add content to container
      tempContainer.innerHTML = bodyContent.innerHTML;
      
      // Wait for rendering
      await new Promise(resolve => {
        setTimeout(() => {
          // Force reflow
          tempContainer.offsetHeight;
          resolve(true);
        }, 500);
      });
      
      // Use html2canvas to capture
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: tempContainer.scrollWidth,
        height: tempContainer.scrollHeight
      });
      
      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;
      
      // Add first page
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Save PDF
      pdf.save(`expense_report_${new Date().toISOString().split('T')[0]}.pdf`);
      
      // Clean up
      document.body.removeChild(tempContainer);
      // Remove temporary styles
      styles.forEach(() => {
        const lastStyle = document.head.querySelector('style:last-of-type');
        if (lastStyle) {
          document.head.removeChild(lastStyle);
        }
      });
      
      await this.dialogService.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      await this.dialogService.error('Error exporting to PDF. Please try again.');
    } finally {
      this.isGeneratingPDF = false;
      this.cdr.markForCheck(); // Trigger change detection for OnPush to hide loader
    }
  }

  generatePDFHTML(expenses: Expense[]): string {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const dateRange = this.getDateRangeText();
    const now = new Date().toLocaleString('en-IN');

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Expense Report</title>
        <style>
          @media print {
            @page { margin: 1cm; }
            body { margin: 0; }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #667eea;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #667eea;
            margin: 0;
            font-size: 28px;
          }
          .summary {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            font-size: 14px;
          }
          .summary-label {
            font-weight: 600;
            color: #555;
          }
          .summary-value {
            color: #333;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
          }
          tr:nth-child(even) {
            background: #f9fafb;
          }
          .amount {
            text-align: right;
            font-weight: 600;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Expense Report</h1>
          <p>Generated on: ${now}</p>
        </div>
        
        <div class="summary">
          <div class="summary-row">
            <span class="summary-label">Period:</span>
            <span class="summary-value">${dateRange}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Total Expenses:</span>
            <span class="summary-value">${expenses.length}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Total Amount:</span>
            <span class="summary-value">₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
    `;

    expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(expense => {
      const categoryName = this.getCategoryName(expense.categoryId) || 'Uncategorized';
      const date = new Date(expense.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const description = this.escapeHtml(expense.description || 'No description');
      const catName = this.escapeHtml(categoryName);
      html += `
        <tr>
          <td>${date}</td>
          <td>${description}</td>
          <td>${catName}</td>
          <td class="amount">₹${expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        
        <div class="footer">
          <p>This report was generated from Expense Tracker</p>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async printExpenses() {
    const filteredExpenses = this.getFilteredExpenses();
    if (filteredExpenses.length === 0) {
      await this.dialogService.warning('No expenses to print. Please adjust your filters.');
      return;
    }

    if (this.isPrinting) {
      return; // Prevent multiple clicks
    }

    this.isPrinting = true;
    this.cdr.markForCheck(); // Trigger change detection for OnPush
    
    try {
      // Create HTML content (same as PDF)
      const htmlContent = this.generatePDFHTML(filteredExpenses);
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        await this.dialogService.error('Please allow pop-ups to print.');
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Wait for content to load, then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    } catch (error) {
      console.error('Error printing expenses:', error);
      await this.dialogService.error('Error printing expenses. Please try again.');
    } finally {
      this.isPrinting = false;
      this.cdr.markForCheck(); // Trigger change detection for OnPush to hide loader
    }
  }

  async validateExpense(): Promise<boolean> {
    if (!this.newExpense.description?.trim()) {
      await this.dialogService.warning('Please enter a description.');
      return false;
    }

    const amount = parseFloat(this.amountInput);
    if (isNaN(amount) || amount <= 0) {
      await this.dialogService.warning('Please enter a valid amount greater than 0.');
      return false;
    }

    if (!this.newExpense.categoryId || this.newExpense.categoryId.trim() === '') {
      await this.dialogService.warning('Please select a category.');
      return false;
    }

    // Validate category exists
    const categoryExists = this.validateCategoryExists(this.newExpense.categoryId);
    if (!categoryExists.exists) {
      if (categoryExists.wasDeleted) {
        await this.dialogService.error(
          'The selected category no longer exists. It may have been deleted. Please select a different category.',
          'Category Deleted'
        );
      } else {
        await this.dialogService.error(
          'Invalid category selected. Please select a valid category from the list.',
          'Invalid Category'
        );
      }
      // Clear invalid category selection
      this.newExpense.categoryId = '';
      return false;
    }

    if (!this.newExpense.date) {
      await this.dialogService.warning('Please select a date.');
      return false;
    }

    // Check if the selected date is in the future
    const selectedDate = new Date(this.newExpense.date);
    const today = new Date();
    
    // Reset both dates to start of day for accurate comparison
    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate > today) {
      await this.dialogService.warning('Cannot add expenses for future dates. Please select today\'s date or a past date.');
      return false;
    }

    return true;
  }

  // Validate if category exists
  validateCategoryExists(categoryId: string): { exists: boolean; wasDeleted: boolean; category?: Category } {
    if (!categoryId || categoryId.trim() === '') {
      return { exists: false, wasDeleted: false };
    }

    const category = this.categories.find(c => c.id === categoryId);
    if (category) {
      return { exists: true, wasDeleted: false, category };
    }

    // Check if this category ID was used in any expense (indicating it was deleted)
    const wasUsed = this.expenses.some(e => e.categoryId === categoryId);
    return { exists: false, wasDeleted: wasUsed };
  }

  // Auto-suggest categories based on description
  suggestCategories(description: string): Category[] {
    if (!description || description.trim().length < 2) {
      return [];
    }

    const searchTerm = description.toLowerCase().trim();
    const suggestions: { category: Category; score: number }[] = [];

    // Check each category for matches
    this.categories.forEach(category => {
      let score = 0;
      const categoryName = category.name.toLowerCase();
      
      // Exact match gets highest score
      if (categoryName === searchTerm) {
        score = 100;
      }
      // Contains match
      else if (categoryName.includes(searchTerm) || searchTerm.includes(categoryName)) {
        score = 50;
      }
      // Word match (check if any word in description matches category name)
      else {
        const descriptionWords = searchTerm.split(/\s+/);
        const categoryWords = categoryName.split(/\s+/);
        
        descriptionWords.forEach(word => {
          if (word.length >= 3) { // Only consider words with 3+ characters
            categoryWords.forEach(catWord => {
              if (catWord.includes(word) || word.includes(catWord)) {
                score += 10;
              }
            });
          }
        });
      }

      // Check if category has been used recently for similar descriptions
      const recentExpenses = this.expenses
        .filter(e => e.categoryId === category.id && e.description)
        .slice(0, 10); // Check last 10 expenses in this category
      
      recentExpenses.forEach(expense => {
        if (expense.description) {
          const expenseDesc = expense.description.toLowerCase();
          if (expenseDesc.includes(searchTerm) || searchTerm.includes(expenseDesc)) {
            score += 5; // Boost score if similar descriptions exist
          }
        }
      });

      if (score > 0) {
        suggestions.push({ category, score });
      }
    });

    // Sort by score descending and return top 3
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.category);
  }

  isFormValid(): boolean {
    const amount = parseFloat(this.amountInput);
    return !!(this.newExpense.description?.trim() && 
              this.amountInput && 
              !isNaN(amount) && 
              amount > 0 && 
              this.newExpense.categoryId && 
              this.newExpense.date);
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
    this.amountInput = '';
    this.showSuggestions = false;
    this.categorySuggestions = [];
  }

  getFilteredExpenses(): Expense[] {
    let filtered = [...this.expenses];

    // Global search filter
    if (this.globalSearch) {
      const searchTerm = this.globalSearch.toLowerCase().trim();
      filtered = filtered.filter(expense => {
        // Search in description
        const descriptionMatch = expense.description?.toLowerCase().includes(searchTerm) || false;
        
        // Search in notes
        const notesMatch = expense.notes?.toLowerCase().includes(searchTerm) || false;
        
        // Search in location
        const locationMatch = expense.location?.toLowerCase().includes(searchTerm) || false;
        
        // Search in payment method
        const paymentMatch = expense.paymentMethod?.toLowerCase().includes(searchTerm) || false;
        
        // Search in receipt number
        const receiptMatch = expense.receiptNumber?.toLowerCase().includes(searchTerm) || false;
        
        // Search in category name
        const categoryName = this.getCategoryName(expense.categoryId)?.toLowerCase() || '';
        const categoryMatch = categoryName.includes(searchTerm);
        
        // Search in amount (as string)
        const amountMatch = expense.amount.toString().includes(searchTerm);
        
        // Search in tags
        const tagsMatch = expense.tags?.some(tag => tag.toLowerCase().includes(searchTerm)) || false;
        
        return descriptionMatch || notesMatch || locationMatch || paymentMatch || 
               receiptMatch || categoryMatch || amountMatch || tagsMatch;
      });
    }

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

    // Apply dashboard filter state only if no manual date filters are set
    if (!this.filterDateFrom && !this.filterDateTo && !this.filterDate) {
      filtered = this.applyDashboardFilters(filtered);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (this.sortBy) {
        case 'date':
          // Sort by creation time (when expense was added) - same as recently added
          aValue = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
          bValue = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        default:
          // Default to creation time for most recent first
          aValue = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
          bValue = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
      }

      if (this.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }

  // Apply dashboard filter state to expenses
  private applyDashboardFilters(expenses: Expense[]): Expense[] {
    if (!this.dashboardPeriod || this.dashboardPeriod === 'all') {
      return expenses;
    }

    const now = new Date();
    
    switch (this.dashboardPeriod) {
      case 'monthly':
        if (this.dashboardMonth && this.dashboardYear) {
          const selectedMonthIndex = parseInt(this.dashboardMonth);
          const selectedYear = parseInt(this.dashboardYear);
          const filtered = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === selectedMonthIndex && 
                   expenseDate.getFullYear() === selectedYear;
          });
          return filtered;
        }
        break;
        
      case 'yearly':
        if (this.dashboardYear) {
          const selectedYear = parseInt(this.dashboardYear);
          const filtered = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === selectedYear;
          });
          return filtered;
        }
        break;
        
      case 'last30':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const filtered30 = expenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate >= thirtyDaysAgo;
        });
        return filtered30;
        
      case 'last7':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        const filtered7 = expenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate >= sevenDaysAgo;
        });
        return filtered7;
        
      case 'custom':
        if (this.dashboardStartDate && this.dashboardEndDate) {
          const filtered = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            const start = new Date(this.dashboardStartDate);
            const end = new Date(this.dashboardEndDate);
            return expenseDate >= start && expenseDate <= end;
          });
          return filtered;
        }
        break;
        
      case 'monthOnly':
        if (this.dashboardMonthOnly && this.dashboardYearOnly) {
          const selectedMonthIndex = parseInt(this.dashboardMonthOnly);
          const selectedYear = parseInt(this.dashboardYearOnly);
          const filtered = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === selectedMonthIndex && 
                   expenseDate.getFullYear() === selectedYear;
          });
          return filtered;
        }
        break;
    }
    
    return expenses;
  }

  getCategoryName(id: string): string {
    const category = this.categoryMap.get(id); // Use Map for O(1) lookup
    return category?.name || 'Unknown';
  }

  getCategoryColor(id: string): string {
    const category = this.categoryMap.get(id); // Use Map for O(1) lookup
    return category?.color || '#999';
  }

  getCategoryIcon(id: string): string {
    const category = this.categoryMap.get(id); // Use Map for O(1) lookup
    return category?.icon || '📌';
  }

  getAmountStatus(amount: number): string {
    if (amount <= 50) {
      return 'low';
    } else if (amount <= 200) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  // Helper method to get month name
  getMonthName(monthIndex: string): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const index = parseInt(monthIndex);
    return months[index] || 'Unknown';
  }

  // Clear dashboard filters
  clearDashboardFilters() {
    this.dashboardPeriod = 'all';
    this.dashboardMonth = '';
    this.dashboardYear = '';
    this.dashboardStartDate = '';
    this.dashboardEndDate = '';
    this.dashboardMonthOnly = '';
    this.dashboardYearOnly = '';
    
    // Also clear the expenses page date filters that were populated from dashboard
    this.filterDateFrom = '';
    this.filterDateTo = '';
    
    // Clear URL query parameters but keep category filter
    const currentParams = this.route.snapshot.queryParams;
    this.router.navigate([], {
      queryParams: {
        category: currentParams['category'],
        filter: currentParams['filter']
      },
      replaceUrl: true
    });
  }

  clearFilters() {
    this.globalSearch = '';
    this.filterAmount = '';
    this.filterCategory = '';
    this.filterDate = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    
    // Reset sort to default (date/recently added first)
    this.sortBy = 'date';
    this.sortOrder = 'desc';
    
    // Clear dashboard filter state
    this.dashboardPeriod = 'all';
    this.dashboardMonth = '';
    this.dashboardYear = '';
    this.dashboardStartDate = '';
    this.dashboardEndDate = '';
    this.dashboardMonthOnly = '';
    this.dashboardYearOnly = '';
    
    // Reset pagination
    this.resetPagination();
    
    // Clear URL query parameters
    this.router.navigate([], {
      queryParams: {},
      replaceUrl: true
    });
  }

  clearCategoryFilter() {
    this.filterCategory = '';
    // Reset pagination when filter changes
    this.resetPagination();
    // Clear the URL query parameters
    this.router.navigate([], {
      queryParams: {},
      queryParamsHandling: 'merge'
    });
  }

  onCategoryFilterChange(): void {
    // Reset pagination when filter changes
    this.resetPagination();
  }

  clearCategory() {
    this.newExpense.categoryId = '';
    this.showSuggestions = false;
    this.categorySuggestions = [];
  }

  onCategoryChange() {
    // Hide suggestions when category is selected
    this.showSuggestions = false;
    this.categorySuggestions = [];
  }

  onDescriptionChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const description = input.value;
    
    // Show suggestions if description has content and no category is selected
    if (description && description.trim().length >= 2 && !this.newExpense.categoryId) {
      this.categorySuggestions = this.suggestCategories(description);
      this.showSuggestions = this.categorySuggestions.length > 0;
    } else {
      this.showSuggestions = false;
      this.categorySuggestions = [];
    }
  }

  selectSuggestedCategory(category: Category) {
    this.newExpense.categoryId = category.id;
    this.showSuggestions = false;
    this.categorySuggestions = [];
  }

  // Bulk Selection Methods
  onSelectionModeToggle(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.bulkSelectionMode = checkbox.checked;
    if (!this.bulkSelectionMode) {
      this.selectedExpenseIds.clear();
    }
  }

  toggleExpenseSelection(expenseId: string) {
    if (this.selectedExpenseIds.has(expenseId)) {
      this.selectedExpenseIds.delete(expenseId);
    } else {
      this.selectedExpenseIds.add(expenseId);
    }
  }

  onExpenseTileClick(expenseId: string, event: Event) {
    // Only handle tile click in bulk selection mode and if expense is not deleted
    if (!this.bulkSelectionMode || this.isExpenseDeleted(expenseId)) {
      return;
    }

    // Don't toggle if clicking on interactive elements (buttons, links, etc.)
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input[type="checkbox"]')) {
      return;
    }

    // Toggle selection
    this.toggleExpenseSelection(expenseId);
  }

  toggleSelectAll() {
    const filteredExpenses = this.getFilteredExpenses();
    const allFilteredSelected = filteredExpenses.every(e => this.selectedExpenseIds.has(e.id));
    
    if (allFilteredSelected) {
      // Deselect all filtered expenses
      filteredExpenses.forEach(e => this.selectedExpenseIds.delete(e.id));
    } else {
      // Select all filtered expenses across all pages
      filteredExpenses.forEach(e => this.selectedExpenseIds.add(e.id));
    }
  }

  isAllSelected(): boolean {
    const filteredExpenses = this.getFilteredExpenses();
    return filteredExpenses.length > 0 && filteredExpenses.every(e => this.selectedExpenseIds.has(e.id));
  }

  getTotalFilteredCount(): number {
    return this.getFilteredExpenses().length;
  }

  getSelectedExpensesTotal(): number {
    return Array.from(this.selectedExpenseIds)
      .map(id => this.expenses.find(e => e.id === id))
      .filter(e => e !== undefined)
      .reduce((sum, e) => sum + (e?.amount || 0), 0);
  }

  // Bulk Delete
  async bulkDeleteExpenses() {
    if (this.selectedExpenseIds.size === 0) {
      await this.dialogService.warning('Please select at least one expense to delete.');
      return;
    }

    const count = this.selectedExpenseIds.size;
    const total = this.getSelectedExpensesTotal();
    const confirmMessage = `Are you sure you want to delete ${count} expense(s) totaling ₹${total.toLocaleString('en-IN')}? This action cannot be undone.`;
    
    const confirmed = await this.dialogService.confirm(
      confirmMessage,
      'Delete Expenses'
    );

    if (!confirmed) {
      return;
    }

    try {
      this.isBulkDeleting = true;
      const expenseIds = Array.from(this.selectedExpenseIds);
      let successCount = 0;
      let failCount = 0;

      for (const expenseId of expenseIds) {
        try {
          const expense = this.expenses.find(e => e.id === expenseId);
          if (expense) {
            // Store expense for undo
            this.deletedExpensesData.set(expense.id, { ...expense });
            this.actionHistoryService.addAction('delete', expense);
            
            // Mark expense as deleted (show undo on tile)
            this.deletedExpenseIds.add(expense.id);
            
            // Set timeout to finalize delete after 5 seconds
            const timeout = setTimeout(async () => {
              await this.finalizeDelete(expense.id);
            }, 5000);
            this.expenseUndoTimeouts.set(expense.id, timeout);
          }
          
          await this.expenseService.delete(expenseId);
          successCount++;
        } catch (error) {
          console.error(`Error deleting expense ${expenseId}:`, error);
          // Clean up if deletion failed
          this.deletedExpenseIds.delete(expenseId);
          this.deletedExpensesData.delete(expenseId);
          if (this.expenseUndoTimeouts.has(expenseId)) {
            clearTimeout(this.expenseUndoTimeouts.get(expenseId));
            this.expenseUndoTimeouts.delete(expenseId);
          }
          failCount++;
        }
      }

      this.selectedExpenseIds.clear();
      
      // Trigger change detection for OnPush to show undo buttons immediately
      this.cdr.markForCheck();
      
      if (failCount === 0) {
        // Don't show success message for bulk delete - let users see undo buttons
        // await this.dialogService.success(`Successfully deleted ${successCount} expense(s)!`);
      } else {
        await this.dialogService.warning(`Deleted ${successCount} expense(s), but ${failCount} failed.`);
      }

      // Exit bulk mode if all selected expenses are deleted
      if (this.selectedExpenseIds.size === 0) {
        this.bulkSelectionMode = false;
      }
    } catch (error) {
      console.error('Error in bulk delete:', error);
      await this.dialogService.error('Error deleting expenses. Please try again.');
    } finally {
      this.isBulkDeleting = false;
    }
  }

  // Log detailed information about orphaned expenses
  logOrphanedExpensesDetails(): void {
    // Method kept for potential future use, but console.log statements removed
  }

  // Amount input validation methods
  onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
    // Remove all non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    // Update the input value
    input.value = value;
    this.amountInput = value;
  }

  onAmountKeypress(event: KeyboardEvent): void {
    const key = event.key;
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    // Allow: backspace, delete, tab, escape, enter, and navigation keys
    if ([8, 9, 27, 13, 46].indexOf(event.keyCode) !== -1 ||
        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (event.keyCode === 65 && event.ctrlKey === true) ||
        (event.keyCode === 67 && event.ctrlKey === true) ||
        (event.keyCode === 86 && event.ctrlKey === true) ||
        (event.keyCode === 88 && event.ctrlKey === true) ||
        // Allow navigation keys
        (event.keyCode >= 35 && event.keyCode <= 39)) {
      return;
    }
    
    // Allow only numbers and decimal point
    if ((key >= '0' && key <= '9') || key === '.') {
      // Prevent multiple decimal points
      if (key === '.' && value.includes('.')) {
        event.preventDefault();
        return;
      }
      return;
    }
    
    // Prevent all other characters
    event.preventDefault();
  }

  // Filter amount input validation methods
  onFilterAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;
    
    // Remove all non-numeric characters except decimal point
    value = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    // Update the input value
    input.value = value;
    this.filterAmount = value;
    
    // Reset pagination when filter changes
    this.resetPagination();
  }

  onFilterAmountKeypress(event: KeyboardEvent): void {
    const key = event.key;
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    // Allow: backspace, delete, tab, escape, enter, and navigation keys
    if ([8, 9, 27, 13, 46].indexOf(event.keyCode) !== -1 ||
        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (event.keyCode === 65 && event.ctrlKey === true) ||
        (event.keyCode === 67 && event.ctrlKey === true) ||
        (event.keyCode === 86 && event.ctrlKey === true) ||
        (event.keyCode === 88 && event.ctrlKey === true) ||
        // Allow navigation keys
        (event.keyCode >= 35 && event.keyCode <= 39)) {
      return;
    }
    
    // Allow only numbers and decimal point
    if ((key >= '0' && key <= '9') || key === '.') {
      // Prevent multiple decimal points
      if (key === '.' && value.includes('.')) {
        event.preventDefault();
        return;
      }
      return;
    }
    
    // Prevent all other characters
    event.preventDefault();
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

  async checkAchievements() {
    const totalExpenses = this.expenses.length;
    
    // Check for milestone achievements
    if (totalExpenses === 10) {
      await this.dialogService.success('Congratulations! You\'ve logged your 10th expense. Keep up the great tracking!');
    } else if (totalExpenses === 50) {
      await this.dialogService.success('Amazing! You\'ve logged 50 expenses. You\'re becoming a tracking expert!');
    } else if (totalExpenses === 100) {
      await this.dialogService.success('Incredible! You\'ve logged 100 expenses. You\'re a financial tracking master!');
    }

    // Check for category mastery
    const categoryCounts: { [key: string]: number } = {};
    this.expenses.forEach(expense => {
      categoryCounts[expense.categoryId] = (categoryCounts[expense.categoryId] || 0) + 1;
    });

    for (const [categoryId, count] of Object.entries(categoryCounts)) {
      if (count === 10) {
        const categoryName = this.getCategoryName(categoryId);
        await this.dialogService.success(`${categoryName} mastery achieved! You\'ve logged 10 expenses in this category.`);
      }
    }

    // Check for daily streak
    await this.checkDailyStreak();
  }

  async checkDailyStreak() {
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
        await this.dialogService.success(`Daily streak of ${streak} days achieved! Keep it up!`);
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

  // Get category by ID with validation
  getCategoryById(categoryId: string): Category | null {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category || null;
  }

  // Get expenses with unknown categories for debugging
  getExpensesWithUnknownCategories(): Expense[] {
    return this.expenses.filter(expense => {
      return !this.categories.find(cat => cat.id === expense.categoryId);
    });
  }

  // Get count of expenses with unknown categories
  getUnknownCategoryCount(): number {
    return this.getExpensesWithUnknownCategories().length;
  }

  // Get maximum allowed date (today's date)
  getMaxDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Handle From Date change
  onFromDateChange(): void {
    // If To Date is set and is earlier than From Date, clear it
    if (this.filterDateTo && this.filterDateFrom && this.filterDateTo < this.filterDateFrom) {
      this.filterDateTo = '';
    }
    
    // Clear dashboard filter state when manual date filter is applied
    if (this.filterDateFrom) {
      this.clearDashboardFilterState();
    }
    
    // Reset pagination when filter changes
    this.resetPagination();
  }

  // Handle To Date change
  onToDateChange(): void {
    // Validate that To Date is not earlier than From Date
    if (this.filterDateFrom && this.filterDateTo && this.filterDateTo < this.filterDateFrom) {
      this.dialogService.warning('To Date cannot be earlier than From Date. Please select a valid date range.');
      this.filterDateTo = '';
    }
    
    // Clear dashboard filter state when manual date filter is applied
    if (this.filterDateTo) {
      this.clearDashboardFilterState();
    }
    
    // Reset pagination when filter changes
    this.resetPagination();
  }

  // Pagination methods
  getPaginatedExpenses(): Expense[] {
    const filteredExpenses = this.getFilteredExpenses();
    const startIndex = this.getStartIndex();
    const endIndex = this.getEndIndex();
    return filteredExpenses.slice(startIndex, endIndex);
  }

  getStartIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage;
  }

  getEndIndex(): number {
    const filteredExpenses = this.getFilteredExpenses();
    return Math.min(this.currentPage * this.itemsPerPage, filteredExpenses.length);
  }

  getTotalPages(): number {
    const filteredExpenses = this.getFilteredExpenses();
    return Math.ceil(filteredExpenses.length / this.itemsPerPage);
  }

  goToPage(page: number): void {
    const totalPages = this.getTotalPages();
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
    }
  }

  // Reset pagination when filters change
  resetPagination(): void {
    this.currentPage = 1;
  }

  // Handle sort change
  onSortChange(): void {
    this.resetPagination();
  }

  // Handle global search change
  onSearchChange(): void {
    this.resetPagination();
  }

  // Clear dashboard filter state when manual filters are applied
  clearDashboardFilterState(): void {
    this.dashboardPeriod = 'all';
    this.dashboardMonth = '';
    this.dashboardYear = '';
    this.dashboardStartDate = '';
    this.dashboardEndDate = '';
    this.dashboardMonthOnly = '';
    this.dashboardYearOnly = '';
  }

  // Get dashboard filter label for display
  getDashboardFilterLabel(): string {
    switch (this.dashboardPeriod) {
      case 'monthly':
        if (this.dashboardMonth && this.dashboardYear) {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${monthNames[parseInt(this.dashboardMonth)]} ${this.dashboardYear}`;
        }
        return 'This Month';
      case 'yearly':
        return this.dashboardYear || 'This Year';
      case 'last30':
        return 'Last 30 Days';
      case 'last7':
        return 'Last 7 Days';
      case 'custom':
        return 'Custom Range';
      case 'monthOnly':
        if (this.dashboardMonthOnly && this.dashboardYearOnly) {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${monthNames[parseInt(this.dashboardMonthOnly)]} ${this.dashboardYearOnly}`;
        }
        return 'Selected Month';
      default:
        return 'Unknown';
    }
  }

  // Toggle methods for expand/collapse functionality
  toggleAddExpenseSection(): void {
    this.isAddExpenseExpanded = !this.isAddExpenseExpanded;
  }

  toggleFiltersSection(): void {
    this.isFiltersExpanded = !this.isFiltersExpanded;
  }

  toggleExpensesListSection(): void {
    this.isExpensesListExpanded = !this.isExpensesListExpanded;
  }

  onSearchFocus(): void {
    this.isSearchFocused = true;
  }

  onSearchBlur(): void {
    this.isSearchFocused = false;
  }
} 