import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { FirebaseService } from '../../core/services/firebase.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { Subscription } from 'rxjs';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss']
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
  filterAmount: string = '';
  filterCategory: string = '';
  filterDate: string = '';
  filterDateFrom: string = '';
  filterDateTo: string = '';
  sortBy: 'date' | 'amount' | 'description' = 'date';
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

  private subscription: Subscription = new Subscription();

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private firebaseService: FirebaseService,
    private filterStateService: FilterStateService,
    private router: Router,
    private route: ActivatedRoute
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
        console.log('Edit mode activated for expense:', editId);
      }
      
      // Handle category filter from dashboard
      if (categoryFilter && filterType === 'category') {
        this.filterCategory = categoryFilter;
        console.log('Category filter applied:', categoryFilter);
      }
    });

    // Always load dashboard filter state from FilterStateService, regardless of navigation method
    this.loadDashboardFilterState();
    
    // Subscribe to filter state changes
    this.subscription.add(
      this.filterStateService.filterState$.subscribe(filterState => {
        console.log('Filter state changed in expenses component:', filterState);
        this.loadDashboardFilterState();
      })
    );

    // Subscribe to Firebase observables for real-time updates
    this.subscription.add(
      this.firebaseService.expenses$.subscribe(expenses => {
        this.expenses = expenses;
        console.log(`Received ${expenses.length} expenses from Firebase`);
        
        // If in edit mode, load the expense for editing
        if (this.isEditMode && this.editingExpenseId) {
          this.loadExpenseForEditing();
        }
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

  // Load dashboard filter state from FilterStateService
  private loadDashboardFilterState() {
    const filterState = this.filterStateService.getFilterState();
    console.log('Loading dashboard filter state from service:', filterState);
    
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
      console.log('Populated expenses page date filters with dashboard custom range:', {
        filterDateFrom: this.filterDateFrom,
        filterDateTo: this.filterDateTo
      });
    } else if (this.dashboardPeriod === 'monthly' && this.dashboardMonth && this.dashboardYear) {
      const monthIndex = parseInt(this.dashboardMonth);
      const year = parseInt(this.dashboardYear);
      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0);
      this.filterDateFrom = startDate.toISOString().split('T')[0];
      this.filterDateTo = endDate.toISOString().split('T')[0];
      console.log('Populated expenses page date filters with dashboard monthly range:', {
        filterDateFrom: this.filterDateFrom,
        filterDateTo: this.filterDateTo
      });
    } else if (this.dashboardPeriod === 'yearly' && this.dashboardYear) {
      const year = parseInt(this.dashboardYear);
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      this.filterDateFrom = startDate.toISOString().split('T')[0];
      this.filterDateTo = endDate.toISOString().split('T')[0];
      console.log('Populated expenses page date filters with dashboard yearly range:', {
        filterDateFrom: this.filterDateFrom,
        filterDateTo: this.filterDateTo
      });
    } else if (this.dashboardPeriod === 'last30') {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);
      this.filterDateFrom = startDate.toISOString().split('T')[0];
      this.filterDateTo = endDate.toISOString().split('T')[0];
      console.log('Populated expenses page date filters with dashboard last 30 days range:', {
        filterDateFrom: this.filterDateFrom,
        filterDateTo: this.filterDateTo
      });
    } else if (this.dashboardPeriod === 'last7') {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);
      this.filterDateFrom = startDate.toISOString().split('T')[0];
      this.filterDateTo = endDate.toISOString().split('T')[0];
      console.log('Populated expenses page date filters with dashboard last 7 days range:', {
        filterDateFrom: this.filterDateFrom,
        filterDateTo: this.filterDateTo
      });
    } else if (this.dashboardPeriod === 'monthOnly' && this.dashboardMonthOnly && this.dashboardYearOnly) {
      const monthIndex = parseInt(this.dashboardMonthOnly);
      const year = parseInt(this.dashboardYearOnly);
      const startDate = new Date(Date.UTC(year, monthIndex, 1));
      const endDate = new Date(Date.UTC(year, monthIndex + 1, 0));
      this.filterDateFrom = startDate.toISOString().split('T')[0];
      this.filterDateTo = endDate.toISOString().split('T')[0];
      console.log('Populated expenses page date filters with dashboard month only range:', {
        filterDateFrom: this.filterDateFrom,
        filterDateTo: this.filterDateTo
      });
    }
    
    console.log('Dashboard filter state loaded into expenses component:', {
      period: this.dashboardPeriod,
      month: this.dashboardMonth,
      year: this.dashboardYear,
      startDate: this.dashboardStartDate,
      endDate: this.dashboardEndDate,
      monthOnly: this.dashboardMonthOnly,
      yearOnly: this.dashboardYearOnly
    });
  }

  async loadData() {
    
    try {
      console.log('Loading data from Firebase...');
      
      // Force reload from Firebase by calling the services directly
      const expenses = await this.expenseService.getAll();
      const categories = await this.categoryService.getAll();

      this.expenses = expenses;
      this.categories = categories;
      
      console.log(`Loaded ${this.expenses.length} expenses and ${this.categories.length} categories`);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      
    }
  }

  loadExpenseForEditing() {
    const expense = this.expenses.find(e => e.id === this.editingExpenseId);
    if (expense) {
      this.newExpense = { ...expense };
      this.amountInput = expense.amount.toString();
      console.log('Loaded expense for editing:', expense);
    } else {
      console.error('Expense not found for editing:', this.editingExpenseId);
      // Clear edit mode if expense not found
      this.isEditMode = false;
      this.editingExpenseId = '';
    }
  }

  async addExpense() {
    if (!this.validateExpense()) {
      return;
    }

    if (this.isEditMode) {
      await this.saveExpenseChanges();
    } else {
      await this.createNewExpense();
    }
  }

  async createNewExpense() {
    try {
      const amount = parseFloat(this.amountInput);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount greater than 0.');
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
        receiptNumber: this.newExpense.receiptNumber || '',
        createdAt: new Date().toISOString()
      };

      const id = await this.expenseService.add(expenseData);
      console.log(`Expense added with Firebase ID: ${id}`);
      
      this.resetForm();
      
      // Check for achievements
      this.checkAchievements();
    } catch (error) {
      console.error('Error adding expense:', error);
    }
  }

  async saveExpenseChanges() {
    try {
      const amount = parseFloat(this.amountInput);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount greater than 0.');
        return;
      }

      const updatedExpense: Expense = {
        ...this.newExpense,
        amount: amount
      };

      await this.expenseService.update(updatedExpense);
      console.log('Expense updated successfully');
      
      // Exit edit mode
      this.isEditMode = false;
      this.editingExpenseId = '';
      this.resetForm();
      
      // Clear query parameters
      this.router.navigate(['/expenses']);
    } catch (error) {
      console.error('Error updating expense:', error);
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
      // Get current category name for display
      const currentCategoryName = this.getCategoryName(expense.categoryId);
      
      // Edit description, amount, date, and category
      const description = window.prompt('Description:', expense.description) || expense.description;
      const amountStr = window.prompt('Amount (₹):', expense.amount.toString()) || expense.amount.toString();
      const dateStr = window.prompt('Date (YYYY-MM-DD):', expense.date) || expense.date;
      
      // Create a more user-friendly category selection
      const categorySelection = this.createCategorySelectionDialog(expense.categoryId);
      if (categorySelection === null) {
        return; // User cancelled
      }
      
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

      // Check if the selected date is in the future
      const selectedDate = new Date(dateStr);
      const today = new Date();
      
      // Reset both dates to start of day for accurate comparison
      selectedDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate > today) {
        alert('Cannot edit expenses to future dates. Please select today\'s date or a past date.');
        return;
      }

      // Validate category
      const selectedCategory = this.categories.find(cat => cat.id === categorySelection);
      if (!selectedCategory) {
        alert(`Error: Category with ID "${categorySelection}" does not exist. Please select a valid category from the list.`);
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
      
      alert(successMessage);
      
    } catch (error) {
      console.error('Error editing expense:', error);
      alert('Error updating expense. Please try again.');
    } finally {
      
    }
  }

  // Helper method to create a user-friendly category selection dialog
  private createCategorySelectionDialog(currentCategoryId: string): string | null {
    // Check if there are any categories available
    if (this.categories.length === 0) {
      alert('No categories available. Please create some categories first before editing expenses.');
      return null;
    }
    
    const currentCategory = this.categories.find(cat => cat.id === currentCategoryId);
    const currentCategoryName = currentCategory ? `${currentCategory.icon} ${currentCategory.name}` : 'Unknown (Category not found)';
    
    let message = `Current category: ${currentCategoryName}\n\n`;
    message += `Available categories:\n`;
    
    // Only show "Keep current category" option if the current category exists
    if (currentCategory) {
      message += `0. Keep current category\n`;
    } else {
      message += `⚠️ Current category not found - please select a new category\n\n`;
    }
    
    this.categories.forEach((cat, index) => {
      message += `${index + 1}. ${cat.icon} ${cat.name}\n`;
    });
    
    const rangeText = currentCategory ? `0-${this.categories.length}` : `1-${this.categories.length}`;
    message += `\nEnter the number of your choice (${rangeText}):`;
    
    const choice = window.prompt(message, '0');
    if (choice === null) {
      return null; // User cancelled
    }
    
    const choiceNum = parseInt(choice);
    const maxChoice = currentCategory ? this.categories.length : this.categories.length;
    const minChoice = currentCategory ? 0 : 1;
    
    if (isNaN(choiceNum) || choiceNum < minChoice || choiceNum > maxChoice) {
      const rangeText = currentCategory ? `0-${this.categories.length}` : `1-${this.categories.length}`;
      alert(`Invalid choice. Please enter a number between ${rangeText}`);
      return this.createCategorySelectionDialog(currentCategoryId); // Retry
    }
    
    if (choiceNum === 0 && currentCategory) {
      return currentCategoryId; // Keep current category
    }
    
    return this.categories[choiceNum - 1].id; // Return selected category ID
  }

  async deleteExpense(expense: Expense) {
    const confirmed = window.confirm(`Are you sure you want to delete "${expense.description}" (₹${expense.amount})?`);
    if (!confirmed) return;

    
    try {
      await this.expenseService.delete(expense.id);
      
    } catch (error) {
      console.error('Error deleting expense:', error);
    } finally {
      
    }
  }

  validateExpense(): boolean {
    if (!this.newExpense.description?.trim()) {
      alert('Please enter a description.');
      return false;
    }

    const amount = parseFloat(this.amountInput);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return false;
    }

    if (!this.newExpense.categoryId) {
      alert('Please select a category.');
      return false;
    }

    if (!this.newExpense.date) {
      alert('Please select a date.');
      return false;
    }

    // Check if the selected date is in the future
    const selectedDate = new Date(this.newExpense.date);
    const today = new Date();
    
    // Reset both dates to start of day for accurate comparison
    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate > today) {
      alert('Cannot add expenses for future dates. Please select today\'s date or a past date.');
      return false;
    }

    return true;
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
  }

  getFilteredExpenses(): Expense[] {
    let filtered = [...this.expenses];

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

    // Apply dashboard filter state if available
    filtered = this.applyDashboardFilters(filtered);

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (this.sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'description':
          aValue = (a.description || '').toLowerCase();
          bValue = (b.description || '').toLowerCase();
          break;
        default:
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
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
    console.log('Applying dashboard filters:', {
      period: this.dashboardPeriod,
      month: this.dashboardMonth,
      year: this.dashboardYear,
      startDate: this.dashboardStartDate,
      endDate: this.dashboardEndDate,
      monthOnly: this.dashboardMonthOnly,
      yearOnly: this.dashboardYearOnly,
      totalExpenses: expenses.length
    });

    if (!this.dashboardPeriod || this.dashboardPeriod === 'all') {
      console.log('No dashboard filter active, returning all expenses');
      return expenses;
    }

    const now = new Date();
    
    switch (this.dashboardPeriod) {
      case 'monthly':
        if (this.dashboardMonth && this.dashboardYear) {
          const selectedMonthIndex = parseInt(this.dashboardMonth);
          const selectedYear = parseInt(this.dashboardYear);
          console.log('Applying monthly filter:', {
            month: selectedMonthIndex,
            year: selectedYear
          });
          const filtered = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === selectedMonthIndex && 
                   expenseDate.getFullYear() === selectedYear;
          });
          console.log(`Monthly filter: ${expenses.length} -> ${filtered.length} expenses`);
          return filtered;
        }
        console.log('Monthly filter: missing month or year');
        break;
        
      case 'yearly':
        if (this.dashboardYear) {
          const selectedYear = parseInt(this.dashboardYear);
          console.log('Applying yearly filter:', { year: selectedYear });
          const filtered = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getFullYear() === selectedYear;
          });
          console.log(`Yearly filter: ${expenses.length} -> ${filtered.length} expenses`);
          return filtered;
        }
        console.log('Yearly filter: missing year');
        break;
        
      case 'last30':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        console.log('Applying last 30 days filter:', { thirtyDaysAgo });
        const filtered30 = expenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate >= thirtyDaysAgo;
        });
        console.log(`Last 30 days filter: ${expenses.length} -> ${filtered30.length} expenses`);
        return filtered30;
        
      case 'last7':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        console.log('Applying last 7 days filter:', { sevenDaysAgo });
        const filtered7 = expenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate >= sevenDaysAgo;
        });
        console.log(`Last 7 days filter: ${expenses.length} -> ${filtered7.length} expenses`);
        return filtered7;
        
      case 'custom':
        if (this.dashboardStartDate && this.dashboardEndDate) {
          console.log('Applying custom date range filter:', {
            startDate: this.dashboardStartDate,
            endDate: this.dashboardEndDate
          });
          const filtered = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            const start = new Date(this.dashboardStartDate);
            const end = new Date(this.dashboardEndDate);
            return expenseDate >= start && expenseDate <= end;
          });
          console.log(`Custom filter: ${expenses.length} -> ${filtered.length} expenses`);
          return filtered;
        }
        console.log('Custom date range filter: missing start or end date');
        break;
        
      case 'monthOnly':
        if (this.dashboardMonthOnly && this.dashboardYearOnly) {
          const selectedMonthIndex = parseInt(this.dashboardMonthOnly);
          const selectedYear = parseInt(this.dashboardYearOnly);
          console.log('Applying month only filter:', {
            month: selectedMonthIndex,
            year: selectedYear
          });
          const filtered = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === selectedMonthIndex && 
                   expenseDate.getFullYear() === selectedYear;
          });
          console.log(`Month only filter: ${expenses.length} -> ${filtered.length} expenses`);
          return filtered;
        }
        console.log('Month only filter: missing month or year');
        break;
    }
    
    console.log('No matching dashboard filter, returning all expenses');
    return expenses;
  }

  getCategoryName(id: string): string {
    const category = this.categories.find(c => c.id === id);
    return category?.name || 'Unknown';
  }

  getCategoryColor(id: string): string {
    const category = this.categories.find(c => c.id === id);
    return category?.color || '#999';
  }

  getCategoryIcon(id: string): string {
    const category = this.categories.find(c => c.id === id);
    return category?.icon || '📌';
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
    this.filterAmount = '';
    this.filterCategory = '';
    this.filterDate = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    
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

  checkAchievements() {
    const totalExpenses = this.expenses.length;
    
    // Check for milestone achievements
    if (totalExpenses === 10) {
      alert('Congratulations! You\'ve logged your 10th expense. Keep up the great tracking!');
    } else if (totalExpenses === 50) {
      alert('Amazing! You\'ve logged 50 expenses. You\'re becoming a tracking expert!');
    } else if (totalExpenses === 100) {
      alert('Incredible! You\'ve logged 100 expenses. You\'re a financial tracking master!');
    }

    // Check for category mastery
    const categoryCounts: { [key: string]: number } = {};
    this.expenses.forEach(expense => {
      categoryCounts[expense.categoryId] = (categoryCounts[expense.categoryId] || 0) + 1;
    });

    Object.entries(categoryCounts).forEach(([categoryId, count]) => {
      if (count === 10) {
        const categoryName = this.getCategoryName(categoryId);
        alert(`${categoryName} mastery achieved! You\'ve logged 10 expenses in this category.`);
      }
    });

    // Check for daily streak
    this.checkDailyStreak();
  }

  checkDailyStreak() {
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
        alert(`Daily streak of ${streak} days achieved! Keep it up!`);
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

  // Validate if a category exists
  validateCategoryExists(categoryId: string): boolean {
    return this.categories.some(cat => cat.id === categoryId);
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
    // Reset pagination when filter changes
    this.resetPagination();
  }

  // Handle To Date change
  onToDateChange(): void {
    // Validate that To Date is not earlier than From Date
    if (this.filterDateFrom && this.filterDateTo && this.filterDateTo < this.filterDateFrom) {
      alert('To Date cannot be earlier than From Date. Please select a valid date range.');
      this.filterDateTo = '';
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
} 