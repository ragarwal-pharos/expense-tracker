import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService, LoadingState } from '../../../core/services/loading.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-overlay" *ngIf="loadingState.isLoading">
      <div class="loading-container">
        <div class="loading-spinner">
          <div class="spinner"></div>
        </div>
        <div class="loading-content">
          <div class="loading-message">{{ loadingState.message }}</div>
          <div class="loading-progress" *ngIf="loadingState.progress !== undefined">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="loadingState.progress"></div>
            </div>
            <div class="progress-text">{{ loadingState.progress | number:'1.0-0' }}%</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./loading.component.scss']
})
export class LoadingComponent implements OnInit, OnDestroy {
  loadingState: LoadingState = { isLoading: false };
  private subscription: Subscription = new Subscription();

  constructor(private loadingService: LoadingService) {}

  ngOnInit() {
    this.subscription.add(
      this.loadingService.loading$.subscribe(state => {
        this.loadingState = state;
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
} 