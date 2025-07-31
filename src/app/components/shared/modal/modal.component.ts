import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';

export interface ModalConfig {
  title: string;
  type: 'edit' | 'delete';
  data: any;
  position?: { x: number; y: number };
}

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" 
         [class.modal-open]="isOpen"
         (click)="closeModal()"
         [@overlayAnimation]="isOpen ? 'visible' : 'hidden'">
      <div class="modal-container" 
           (click)="$event.stopPropagation()"
           [@modalAnimation]="isOpen ? 'visible' : 'hidden'">
        
        <!-- Modal Header -->
        <div class="modal-header">
          <h3 class="modal-title">
            <span class="modal-icon">{{ config?.type === 'edit' ? '✏️' : '⚠️' }}</span>
            {{ config?.title }}
          </h3>
          <button class="modal-close" (click)="closeModal()">×</button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body">
          <!-- Edit Form -->
          <div *ngIf="config?.type === 'edit' && config?.data" class="edit-form">
            <div class="form-group">
              <label for="editName">Category Name</label>
              <input 
                type="text" 
                id="editName"
                [(ngModel)]="editData.name" 
                class="form-control"
                placeholder="Enter category name"
                [class.error]="isDuplicateName">
              <div *ngIf="isDuplicateName" class="error-message">
                Category name already exists!
              </div>
            </div>
            
            <div class="form-group">
              <label for="editColor">Color</label>
              <div class="color-picker">
                <input 
                  type="color" 
                  id="editColor"
                  [(ngModel)]="editData.color" 
                  class="color-input">
                <button type="button" class="random-color-btn" (click)="setRandomColor()">
                  🎲 Random
                </button>
              </div>
            </div>
          </div>

          <!-- Delete Confirmation -->
          <div *ngIf="config?.type === 'delete' && config?.data" class="delete-confirmation">
            <div class="delete-preview">
              <div class="category-icon-large" [style.background-color]="config?.data?.color">
                {{ config?.data?.icon }}
              </div>
              <div class="category-info">
                <h4 class="category-name">{{ config?.data?.name }}</h4>
                <p class="category-description">This category will be permanently deleted.</p>
              </div>
            </div>
            
            <div class="warning-alert">
              <div class="warning-content">
                <div class="warning-icon-container">
                  <span class="warning-icon">⚠️</span>
                </div>
                <div class="warning-text">
                  <strong>Warning:</strong> Deleting this category will also remove all associated expenses.
                  This action cannot be undone.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <div class="modal-actions">
            <button class="btn-cancel" (click)="closeModal()">
              Cancel
            </button>
            <button *ngIf="config?.type === 'edit'" 
                    class="btn-save" 
                    (click)="saveEdit()"
                    [disabled]="!editData.name?.trim() || isDuplicateName">
              Save Changes
            </button>
            <button *ngIf="config?.type === 'delete'" 
                    class="btn-delete" 
                    (click)="confirmDelete()">
              Delete Category
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./modal.component.scss'],
  animations: [
    trigger('overlayAnimation', [
      state('hidden', style({
        opacity: 0,
        visibility: 'hidden'
      })),
      state('visible', style({
        opacity: 1,
        visibility: 'visible'
      })),
      transition('hidden <=> visible', animate('300ms cubic-bezier(0.4, 0, 0.2, 1)'))
    ]),
    trigger('modalAnimation', [
      state('hidden', style({
        opacity: 0,
        transform: 'translate(-50%, -50%) scale(0.8)'
      })),
      state('visible', style({
        opacity: 1,
        transform: 'translate(-50%, -50%) scale(1)'
      })),
      transition('hidden <=> visible', animate('300ms cubic-bezier(0.4, 0, 0.2, 1)'))
    ])
  ]
})
export class ModalComponent implements OnInit, OnDestroy {
  @Input() config: ModalConfig | null = null;
  @Output() save = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();

  isOpen = false;
  editData: any = {};
  isDuplicateName = false;
  originalCategories: any[] = [];

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.isOpen) {
      this.closeModal();
    }
  }

  ngOnInit() {
    this.originalCategories = JSON.parse(localStorage.getItem('categories') || '[]');
    
    // Handle window resize to reposition modal if needed
    window.addEventListener('resize', () => {
      if (this.isOpen) {
        this.positionModal();
      }
    });
  }

  ngOnDestroy() {
    this.restoreScroll();
  }

  openModal(config: ModalConfig) {
    this.config = config;
    this.isOpen = true;
    this.preventScroll();
    
    // Position modal in the center of the visible viewport
    this.positionModal();
    
    if (config.type === 'edit' && config.data) {
      this.editData = { ...config.data };
      this.checkDuplicateName();
    }
  }

  private positionModal() {
    // Get current scroll position
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Calculate center of visible viewport
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Position modal in center of visible viewport
    const centerY = scrollTop + (viewportHeight / 2);
    const centerX = scrollLeft + (viewportWidth / 2);
    
    // Apply positioning to modal container
    const modalContainer = document.querySelector('.modal-container') as HTMLElement;
    if (modalContainer) {
      modalContainer.style.position = 'absolute';
      modalContainer.style.top = `${centerY}px`;
      modalContainer.style.left = `${centerX}px`;
      modalContainer.style.transform = 'translate(-50%, -50%)';
    }
  }

  closeModal() {
    this.isOpen = false;
    this.restoreScroll();
    this.close.emit();
  }

  saveEdit() {
    if (this.editData.name?.trim() && !this.isDuplicateName) {
      this.save.emit(this.editData);
      this.closeModal();
    }
  }

  confirmDelete() {
    if (this.config?.data) {
      this.delete.emit(this.config.data);
      this.closeModal();
    }
  }

  setRandomColor() {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140', '#a8edea', '#fed6e3'];
    this.editData.color = colors[Math.floor(Math.random() * colors.length)];
  }

  checkDuplicateName() {
    if (!this.editData.name?.trim()) {
      this.isDuplicateName = false;
      return;
    }
    
    const trimmedName = this.editData.name.trim().toLowerCase();
    this.isDuplicateName = this.originalCategories.some(cat => 
      cat.id !== this.config?.data?.id && 
      cat.name.toLowerCase() === trimmedName
    );
  }

  private preventScroll() {
    document.body.style.overflow = 'hidden';
    document.body.style.overflowX = 'hidden';
  }

  private restoreScroll() {
    document.body.style.overflow = '';
    document.body.style.overflowX = '';
  }
} 