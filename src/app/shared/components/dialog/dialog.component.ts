import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogService, DialogConfig, DialogResult } from '../../../core/services/dialog.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dialog-overlay" *ngIf="config" (click)="onOverlayClick($event)">
      <div class="dialog-container" [class]="config.type" (click)="$event.stopPropagation()">
        <!-- Dialog Header -->
        <div class="dialog-header">
          <div class="header-content">
            <div class="header-icon">
              <span *ngIf="config.type === 'info'">ℹ️</span>
              <span *ngIf="config.type === 'success'">✅</span>
              <span *ngIf="config.type === 'warning'">⚠️</span>
              <span *ngIf="config.type === 'error'">❌</span>
              <span *ngIf="config.type === 'confirm'">❓</span>
            </div>
            <h3 class="dialog-title">{{ config.title }}</h3>
          </div>
          <button class="close-btn" (click)="onCancel()" *ngIf="config.type === 'confirm' && config.cancelText">
            <span>✕</span>
          </button>
        </div>

        <!-- Dialog Body -->
        <div class="dialog-body">
          <p class="dialog-message" *ngIf="config.message">{{ config.message }}</p>
          
          <!-- Text Input -->
          <div class="input-group" *ngIf="config.inputType">
            <label *ngIf="config.inputLabel" class="input-label">{{ config.inputLabel }}</label>
            <input 
              *ngIf="config.inputType === 'text' || config.inputType === 'email' || config.inputType === 'password'"
              [type]="config.inputType"
              class="dialog-input"
              [(ngModel)]="inputValue"
              [placeholder]="config.inputPlaceholder || ''"
              (keyup.enter)="onConfirm()"
              (keyup.escape)="onCancel()"
              #inputRef>
            
            <input 
              *ngIf="config.inputType === 'number'"
              type="number"
              class="dialog-input"
              [(ngModel)]="inputValue"
              [placeholder]="config.inputPlaceholder || ''"
              (keyup.enter)="onConfirm()"
              (keyup.escape)="onCancel()"
              #inputRef>
            
            <input 
              *ngIf="config.inputType === 'date'"
              type="date"
              class="dialog-input"
              [(ngModel)]="inputValue"
              (keyup.enter)="onConfirm()"
              (keyup.escape)="onCancel()"
              #inputRef>
          </div>

          <!-- Options Selection -->
          <div class="options-group" *ngIf="config.options && config.options.length > 0">
            <div class="options-list">
              <label 
                *ngFor="let option of config.options; let i = index" 
                class="option-item"
                [class.selected]="selectedOption === option.value">
                <input 
                  type="radio" 
                  [name]="'option-' + i"
                  [value]="option.value"
                  [(ngModel)]="selectedOption"
                  class="option-radio">
                <span class="option-icon" *ngIf="option.icon">{{ option.icon }}</span>
                <span class="option-label">{{ option.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Dialog Footer -->
        <div class="dialog-footer">
          <button 
            *ngIf="config.cancelText"
            class="btn btn-secondary"
            (click)="onCancel()">
            {{ config.cancelText }}
          </button>
          <button 
            class="btn btn-primary"
            [class]="'btn-' + config.type"
            (click)="onConfirm()"
            [disabled]="!isValidInput()">
            {{ config.confirmText || 'OK' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .dialog-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow: hidden;
      animation: dialogSlideIn 0.3s ease-out;
      display: flex;
      flex-direction: column;
    }

    @keyframes dialogSlideIn {
      from {
        opacity: 0;
        transform: scale(0.9) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .dialog-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon {
      font-size: 24px;
    }

    .dialog-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 20px;
      color: #6b7280;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .dialog-body {
      padding: 20px 24px;
      overflow-y: auto;
      max-height: calc(80vh - 160px); /* Account for header and footer */
      min-height: 0; /* Allow flex shrinking */
    }

    .dialog-message {
      margin: 0 0 20px 0;
      color: #4b5563;
      line-height: 1.5;
    }

    .input-group {
      margin-bottom: 20px;
    }

    .input-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #374151;
    }

    .dialog-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .dialog-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .options-group {
      margin-bottom: 20px;
      max-height: 300px;
      overflow: hidden;
    }

    .options-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
      padding-right: 8px;
    }

    .options-list::-webkit-scrollbar {
      width: 6px;
    }

    .options-list::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }

    .options-list::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }

    .options-list::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }

    .option-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .option-item:hover {
      border-color: #d1d5db;
      background: #f9fafb;
    }

    .option-item.selected {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .option-radio {
      margin: 0;
    }

    .option-icon {
      font-size: 18px;
    }

    .option-label {
      font-weight: 500;
      color: #374151;
    }

    .dialog-footer {
      padding: 16px 24px 20px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      flex-shrink: 0; /* Prevent footer from shrinking */
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }

    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }

    .btn-secondary:hover {
      background: #e5e7eb;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    .btn-primary:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .btn-success {
      background: #10b981;
      color: white;
    }

    .btn-success:hover {
      background: #059669;
    }

    .btn-warning {
      background: #f59e0b;
      color: white;
    }

    .btn-warning:hover {
      background: #d97706;
    }

    .btn-error {
      background: #ef4444;
      color: white;
    }

    .btn-error:hover {
      background: #dc2626;
    }

    /* Dialog container colored borders */
    .dialog-container.info {
      border-left: 5px solid #3b82f6;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), -2px 0 0 rgba(59, 130, 246, 0.1);
    }

    .dialog-container.success {
      border-left: 5px solid #10b981;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), -2px 0 0 rgba(16, 185, 129, 0.1);
    }

    .dialog-container.warning {
      border-left: 5px solid #f59e0b;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), -2px 0 0 rgba(245, 158, 11, 0.1);
    }

    .dialog-container.error {
      border-left: 5px solid #ef4444;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), -2px 0 0 rgba(239, 68, 68, 0.1);
    }

    .dialog-container.confirm {
      border-left: 5px solid #8b5cf6;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), -2px 0 0 rgba(139, 92, 246, 0.1);
    }

    /* Mobile responsive improvements */
    @media (max-width: 768px) {
      .dialog-container {
        max-width: 95%;
        max-height: 90vh;
      }

      .dialog-body {
        max-height: calc(90vh - 140px);
        padding: 16px 20px;
      }

      .options-group {
        max-height: 250px;
      }

      .options-list {
        max-height: 250px;
      }

      .option-item {
        padding: 10px 12px;
        font-size: 14px;
      }
    }

    @media (max-width: 480px) {
      .dialog-container {
        max-width: 98%;
        max-height: 95vh;
      }

      .dialog-body {
        max-height: calc(95vh - 120px);
        padding: 12px 16px;
      }

      .options-group {
        max-height: 200px;
      }

      .options-list {
        max-height: 200px;
      }
    }
  `]
})
export class DialogComponent implements OnInit, OnDestroy {
  @Input() config: DialogConfig | null = null;
  @Output() result = new EventEmitter<DialogResult>();

  inputValue: string = '';
  selectedOption: string = '';
  private subscription: Subscription = new Subscription();

  constructor(private dialogService: DialogService) {}

  ngOnInit() {
    this.subscription.add(
      this.dialogService.dialog$.subscribe(config => {
        this.config = config;
        if (config) {
          this.inputValue = config.inputValue || '';
          this.selectedOption = config.selectedValue || '';
          
          // Focus on input after dialog opens
          setTimeout(() => {
            const input = document.querySelector('.dialog-input') as HTMLInputElement;
            if (input) {
              input.focus();
              input.select();
            }
          }, 100);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  onConfirm() {
    if (!this.isValidInput()) return;

    const result: DialogResult = {
      confirmed: true,
      value: this.inputValue,
      selectedOption: this.selectedOption
    };

    this.dialogService.handleResult(result);
  }

  onCancel() {
    const result: DialogResult = {
      confirmed: false
    };

    this.dialogService.handleResult(result);
  }

  onOverlayClick(event: Event) {
    // Only close on overlay click for certain dialog types
    if (this.config && (this.config.type === 'confirm' || this.config.type === 'info')) {
      this.onCancel();
    }
  }

  isValidInput(): boolean {
    if (!this.config) return false;

    // For input dialogs, check if input is valid
    if (this.config.inputType) {
      if (this.config.inputType === 'number') {
        return this.inputValue !== '' && !isNaN(Number(this.inputValue));
      }
      return this.inputValue.trim() !== '';
    }

    // For selection dialogs, check if option is selected
    if (this.config.options && this.config.options.length > 0) {
      return this.selectedOption !== '';
    }

    // For simple dialogs, always valid
    return true;
  }
}
