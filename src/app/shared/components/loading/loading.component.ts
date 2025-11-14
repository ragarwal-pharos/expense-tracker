import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-container" 
         [class.fullscreen]="fullscreen"
         [class.inline]="type === 'inline'"
         [class.button]="type === 'button'"
         [class.card]="type === 'card'">
      <div class="loading-spinner">
        <div class="spinner" 
             [class.small]="size === 'small'" 
             [class.large]="size === 'large'"
             [class.button-size]="type === 'button'"></div>
        <p class="loading-text" *ngIf="message && type !== 'button'">{{ message }}</p>
        <p class="loading-text" *ngIf="!message && type !== 'button'">Loading...</p>
        <span class="button-text" *ngIf="type === 'button'">{{ message || 'Loading...' }}</span>
      </div>
    </div>
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 200px;
      padding: 2rem;
    }

    .loading-container.fullscreen {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(5px);
      z-index: 99999 !important;
      min-height: 100vh;
      margin: 0 !important;
      padding: 0 !important;
    }

    .loading-container.inline {
      min-height: auto;
      padding: 1rem;
    }

    .loading-container.button {
      min-height: auto;
      padding: 0.5rem 1rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      display: inline-flex;
    }

    .loading-container.card {
      min-height: 300px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      margin: 1rem 0;
    }

    .loading-spinner {
      text-align: center;
      color: #666;
      position: relative;
      z-index: 100000;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #9b6b9b;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    .spinner.small {
      width: 20px;
      height: 20px;
      border-width: 2px;
      margin: 0 auto 0.5rem;
    }

    .spinner.large {
      width: 60px;
      height: 60px;
      border-width: 6px;
      margin: 0 auto 1.5rem;
    }

    .spinner.button-size {
      width: 16px;
      height: 16px;
      border-width: 2px;
      margin: 0 0.5rem 0 0;
    }

    .loading-text {
      font-size: 1.1rem;
      font-weight: 500;
      margin: 0;
      color: #666;
    }

    .button-text {
      font-size: 0.9rem;
      font-weight: 500;
      color: #666;
    }

    .loading-container.inline .loading-text {
      font-size: 0.9rem;
      margin: 0;
    }

    .loading-container.button .loading-text {
      font-size: 0.8rem;
      margin: 0;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class LoadingComponent {
  @Input() message: string = '';
  @Input() fullscreen: boolean = false;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() type: 'default' | 'inline' | 'button' | 'card' = 'default';
}
