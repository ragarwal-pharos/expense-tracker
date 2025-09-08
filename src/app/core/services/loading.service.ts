import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  type?: 'default' | 'inline' | 'button' | 'card';
}

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<LoadingState>({ isLoading: false });
  public loading$ = this.loadingSubject.asObservable();

  // Global loading state
  private globalLoadingSubject = new BehaviorSubject<boolean>(false);
  public globalLoading$ = this.globalLoadingSubject.asObservable();

  // Specific loading states
  private savingSubject = new BehaviorSubject<boolean>(false);
  public saving$ = this.savingSubject.asObservable();

  private deletingSubject = new BehaviorSubject<boolean>(false);
  public deleting$ = this.deletingSubject.asObservable();

  private editingSubject = new BehaviorSubject<boolean>(false);
  public editing$ = this.editingSubject.asObservable();

  private filteringSubject = new BehaviorSubject<boolean>(false);
  public filtering$ = this.filteringSubject.asObservable();

  // Global loading methods
  showGlobalLoading(message?: string): void {
    this.globalLoadingSubject.next(true);
    this.loadingSubject.next({ 
      isLoading: true, 
      message: message || 'Loading...',
      type: 'card'
    });
  }

  hideGlobalLoading(): void {
    this.globalLoadingSubject.next(false);
    this.loadingSubject.next({ isLoading: false });
  }

  // Specific loading methods
  setSaving(isSaving: boolean, message?: string): void {
    this.savingSubject.next(isSaving);
    if (isSaving) {
      this.loadingSubject.next({ 
        isLoading: true, 
        message: message || 'Saving...',
        type: 'button'
      });
    } else {
      this.loadingSubject.next({ isLoading: false });
    }
  }

  setDeleting(isDeleting: boolean, message?: string): void {
    this.deletingSubject.next(isDeleting);
    if (isDeleting) {
      this.loadingSubject.next({ 
        isLoading: true, 
        message: message || 'Deleting...',
        type: 'button'
      });
    } else {
      this.loadingSubject.next({ isLoading: false });
    }
  }

  setEditing(isEditing: boolean, message?: string): void {
    this.editingSubject.next(isEditing);
    if (isEditing) {
      this.loadingSubject.next({ 
        isLoading: true, 
        message: message || 'Editing...',
        type: 'button'
      });
    } else {
      this.loadingSubject.next({ isLoading: false });
    }
  }

  setFiltering(isFiltering: boolean, message?: string): void {
    this.filteringSubject.next(isFiltering);
    if (isFiltering) {
      this.loadingSubject.next({ 
        isLoading: true, 
        message: message || 'Filtering...',
        type: 'inline'
      });
    } else {
      this.loadingSubject.next({ isLoading: false });
    }
  }

  // Utility methods
  getCurrentLoadingState(): LoadingState {
    return this.loadingSubject.value;
  }

  isAnyLoading(): boolean {
    return this.globalLoadingSubject.value || 
           this.savingSubject.value || 
           this.deletingSubject.value || 
           this.editingSubject.value || 
           this.filteringSubject.value;
  }

  // Clear all loading states
  clearAllLoading(): void {
    this.globalLoadingSubject.next(false);
    this.savingSubject.next(false);
    this.deletingSubject.next(false);
    this.editingSubject.next(false);
    this.filteringSubject.next(false);
    this.loadingSubject.next({ isLoading: false });
  }
}
