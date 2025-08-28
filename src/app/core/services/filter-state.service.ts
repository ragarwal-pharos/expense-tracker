import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface FilterState {
  selectedPeriod: string;
  selectedMonth: string;
  selectedYear: string;
  customStartDate: string;
  customEndDate: string;
  selectedMonthOnly?: string;
  selectedYearOnly?: string;
  filterCategory?: string;
  filterType?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FilterStateService {
  private filterStateSubject = new BehaviorSubject<FilterState>({
    selectedPeriod: 'all',
    selectedMonth: new Date().getMonth().toString(),
    selectedYear: new Date().getFullYear().toString(),
    customStartDate: '',
    customEndDate: ''
  });

  public filterState$ = this.filterStateSubject.asObservable();

  constructor() {
    // Load filter state from localStorage on service initialization
    this.loadFilterState();
  }

  // Update filter state
  updateFilterState(newState: Partial<FilterState>): void {
    const currentState = this.filterStateSubject.value;
    const updatedState = { ...currentState, ...newState };
    console.log('Updating filter state:', { currentState, newState, updatedState });
    this.filterStateSubject.next(updatedState);
    this.saveFilterState(updatedState);
  }

  // Get current filter state
  getFilterState(): FilterState {
    const state = this.filterStateSubject.value;
    console.log('Getting filter state:', state);
    return state;
  }

  // Clear filter state
  clearFilterState(): void {
    const defaultState: FilterState = {
      selectedPeriod: 'all',
      selectedMonth: new Date().getMonth().toString(),
      selectedYear: new Date().getFullYear().toString(),
      customStartDate: '',
      customEndDate: ''
    };
    this.filterStateSubject.next(defaultState);
    this.saveFilterState(defaultState);
  }

  // Save filter state to localStorage
  private saveFilterState(state: FilterState): void {
    try {
      localStorage.setItem('expenseTracker_filterState', JSON.stringify(state));
      console.log('Filter state saved to localStorage:', state);
    } catch (error) {
      console.error('Error saving filter state to localStorage:', error);
    }
  }

  // Load filter state from localStorage
  private loadFilterState(): void {
    try {
      const savedState = localStorage.getItem('expenseTracker_filterState');
      console.log('Loading filter state from localStorage:', savedState);
      if (savedState) {
        const state = JSON.parse(savedState);
        console.log('Parsed filter state:', state);
        this.filterStateSubject.next(state);
      } else {
        console.log('No saved filter state found in localStorage');
      }
    } catch (error) {
      console.error('Error loading filter state from localStorage:', error);
    }
  }

  // Check if custom date range is active
  isCustomDateRangeActive(): boolean {
    const state = this.getFilterState();
    return state.selectedPeriod === 'custom' && 
           !!state.customStartDate && 
           !!state.customEndDate;
  }

  // Get custom date range
  getCustomDateRange(): { startDate: string; endDate: string } | null {
    const state = this.getFilterState();
    if (this.isCustomDateRangeActive()) {
      return {
        startDate: state.customStartDate,
        endDate: state.customEndDate
      };
    }
    return null;
  }

  // Get current period filter
  getCurrentPeriodFilter(): string {
    return this.getFilterState().selectedPeriod;
  }
}
