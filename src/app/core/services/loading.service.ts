import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingState = new BehaviorSubject<LoadingState>({ isLoading: false });
  public loading$ = this.loadingState.asObservable();

  show(message?: string, progress?: number) {
    this.loadingState.next({ 
      isLoading: true, 
      message: message || 'Loading...', 
      progress 
    });
  }

  hide() {
    this.loadingState.next({ isLoading: false });
  }

  updateProgress(progress: number, message?: string) {
    this.loadingState.next({ 
      isLoading: true, 
      message: message || 'Loading...', 
      progress 
    });
  }

  getCurrentState(): LoadingState {
    return this.loadingState.value;
  }
} 