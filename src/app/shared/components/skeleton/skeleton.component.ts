import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton-container" [ngClass]="type">
      <div class="skeleton-line" 
           *ngFor="let line of lines" 
           [style.width.%]="line.width"
           [style.height.px]="line.height"
           [style.margin-bottom.px]="line.marginBottom">
      </div>
    </div>
  `,
  styles: [`
    .skeleton-container {
      animation: pulse 1.5s ease-in-out infinite;
    }

    .skeleton-line {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: loading 1.5s infinite;
      border-radius: 4px;
    }

    .skeleton-container.card {
      padding: 1rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .skeleton-container.list-item {
      padding: 1rem;
      border-bottom: 1px solid #f0f0f0;
    }

    .skeleton-container.expense-item {
      padding: 1rem;
      border-radius: 8px;
      background: #f8f9fa;
      margin-bottom: 0.5rem;
    }

    @keyframes loading {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
  `]
})
export class SkeletonComponent {
  @Input() type: 'card' | 'list-item' | 'expense-item' = 'card';
  @Input() lines: Array<{width: number, height: number, marginBottom?: number}> = [
    { width: 100, height: 20, marginBottom: 10 },
    { width: 80, height: 16, marginBottom: 8 },
    { width: 60, height: 16, marginBottom: 0 }
  ];
}
