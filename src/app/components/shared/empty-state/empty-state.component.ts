import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface EmptyStateConfig {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionCallback?: () => void;
  showAction?: boolean;
}

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state">
      <div class="empty-icon">{{ config.icon }}</div>
      <div class="empty-content">
        <h3 class="empty-title">{{ config.title }}</h3>
        <p class="empty-message">{{ config.message }}</p>
        <button 
          *ngIf="config.showAction && config.actionLabel"
          class="empty-action"
          (click)="config.actionCallback?.()">
          {{ config.actionLabel }}
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./empty-state.component.scss']
})
export class EmptyStateComponent {
  @Input() config!: EmptyStateConfig;
} 