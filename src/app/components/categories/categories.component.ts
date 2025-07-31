import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../core/services/category.service';
import { Category } from '../../core/models/category.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit, OnDestroy {
  categories: Category[] = [];
  newCategory: Category = {
    id: '',
    name: '',
    color: '#ff6b9d',
    icon: '📌'
  };

  // Filter and search
  searchTerm: string = '';
  sortBy: 'name' | 'usage' = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';

  // Validation properties
  isDuplicateCategory: boolean = false;

  private subscription: Subscription = new Subscription();

  constructor(
    private categoryService: CategoryService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  async loadData() {
    try {
      this.categories = await this.categoryService.getAll();
      // Removed notificationService.success
    } catch (error) {
      // Removed notificationService.handleError
    } finally {
      // Removed loadingService.hide();
    }
  }

  async initializeDefaultCategories() {
    try {
      await this.categoryService.forceInitializeDefaultCategories();
      await this.loadData();
      // Removed notificationService.success
    } catch (error) {
      // Removed notificationService.handleError
    } finally {
      // Removed loadingService.hide();
    }
  }

  async addCategory() {
    if (!this.validateCategory()) {
      return;
    }

    try {
      const categoryData: Omit<Category, 'id'> = {
        name: this.newCategory.name.trim(),
        color: this.newCategory.color,
        icon: this.newCategory.icon
      };

      const id = await this.categoryService.add(categoryData);
      console.log(`Category added with Firebase ID: ${id}`);
      
      await this.loadData();
      this.resetForm();
      // Removed notificationService.categoryAdded
    } catch (error) {
      // Removed notificationService.handleError
    } finally {
      // Removed loadingService.hide();
    }
  }

  async updateCategory(category: Category) {
    try {
      console.log(`Updating category: ${category.name} (ID: ${category.id}, length: ${category.id.length})`);
      
      // Simplified edit - only name and color
      const name = window.prompt('Category name:', category.name) || category.name;
      const color = window.prompt('Category color (hex):', category.color) || category.color;

      // Validate inputs
      if (!name.trim()) {
        // Removed notificationService.error
        return;
      }

      const updatedCategory: Category = {
        ...category,
        name: name.trim(),
        color: color
      };

      console.log(`Sending update to Firebase for category ID: ${updatedCategory.id}`);
      await this.categoryService.update(updatedCategory);
      console.log('Category updated successfully');
      
      await this.loadData(); // Reload data after updating
      
      // Removed notificationService.categoryUpdated
    } catch (error) {
      console.error('Error updating category:', error);
      // Removed notificationService.handleError
    } finally {
      // Removed loadingService.hide();
    }
  }

  async deleteCategory(category: Category) {
    const confirmed = window.confirm(`Are you sure you want to delete "${category.name}"? This will also delete all associated expenses.`);
    if (!confirmed) return;

    try {
      console.log(`Deleting category: ${category.name} (ID: ${category.id})`);
      
      await this.categoryService.delete(category.id);
      console.log('Category deleted successfully');
      
      await this.loadData(); // Reload data after deleting
      
      // Removed notificationService.categoryDeleted
    } catch (error) {
      console.error('Error deleting category:', error);
      // Removed notificationService.handleError
    } finally {
      // Removed loadingService.hide();
    }
  }

  confirmDelete(category: Category) {
    this.deleteCategory(category);
  }

  validateCategory(): boolean {
    if (!this.newCategory.name?.trim()) {
      // Removed notificationService.error
      return false;
    }

    // Check for duplicate names
    const existingCategory = this.categories.find(cat => 
      cat.name.toLowerCase() === this.newCategory.name.toLowerCase()
    );
    
    this.isDuplicateCategory = !!existingCategory;
    
    if (this.isDuplicateCategory) {
      // Removed notificationService.error
      return false;
    }

    return true;
  }

  clearValidationErrors() {
    this.isDuplicateCategory = false;
  }

  resetForm() {
    this.newCategory = {
      id: '',
      name: '',
      color: '#ff6b9d',
      icon: '📌'
    };
    this.clearValidationErrors();
  }

  getFilteredCategories(): Category[] {
    let filtered = [...this.categories];

    // Filter by search term
    if (this.searchTerm) {
      filtered = filtered.filter(cat => 
        cat.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (cat.icon || '').includes(this.searchTerm)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (this.sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'usage':
          aValue = this.getCategoryUsage(a.id);
          bValue = this.getCategoryUsage(b.id);
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (this.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }

  getCategoryUsage(categoryId: string): number {
    // This would typically come from the expense service
    // For now, return a random number for demonstration
    return Math.floor(Math.random() * 100);
  }

  clearSearch() {
    this.searchTerm = '';
  }

  generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Color presets for easy selection
  getColorPresets(): string[] {
    return [
      '#ff6b9d', '#4ecdc4', '#45b7d1', '#96ceb4', '#ff8e53',
      '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#34495e',
      '#1abc9c', '#e67e22', '#3498db', '#8e44ad', '#16a085'
    ];
  }

  // Icon presets for easy selection
  getIconPresets(): string[] {
    return [
      '🍽️', '🚗', '🛍️', '🎬', '💡', '🏥', '📚', '🏠', '🛡️', '💰',
      '🍕', '☕', '🎵', '🎮', '🏃', '🧘', '📱', '💻', '📷', '🎨',
      '🌱', '🐕', '🐱', '🦜', '🐠', '🌺', '🌲', '🌊', '⛰️', '🏖️'
    ];
  }

  selectColor(color: string) {
    this.newCategory.color = color;
  }

  selectIcon(icon: string) {
    this.newCategory.icon = icon;
  }

  setRandomColor() {
    const colors = this.getColorPresets();
    const randomIndex = Math.floor(Math.random() * colors.length);
    this.newCategory.color = colors[randomIndex];
  }

  getCategoryCount(): number {
    return this.getFilteredCategories().length;
  }

  getTotalCategories(): number {
    return this.categories.length;
  }

  getMostUsedCategory(): Category | null {
    if (this.categories.length === 0) return null;
    
    return this.categories.reduce((mostUsed, current) => {
      const mostUsedUsage = this.getCategoryUsage(mostUsed.id);
      const currentUsage = this.getCategoryUsage(current.id);
      return currentUsage > mostUsedUsage ? current : mostUsed;
    });
  }

  getLeastUsedCategory(): Category | null {
    if (this.categories.length === 0) return null;
    
    return this.categories.reduce((leastUsed, current) => {
      const leastUsedUsage = this.getCategoryUsage(leastUsed.id);
      const currentUsage = this.getCategoryUsage(current.id);
      return currentUsage < leastUsedUsage ? current : leastUsed;
    });
  }

  async cleanupDuplicates() {
    try {
      console.log('Starting duplicate cleanup...');
      await this.categoryService.triggerDuplicateCleanup();
      await this.loadData();
      console.log('Duplicate cleanup completed');
      alert('Duplicate categories have been cleaned up successfully!');
    } catch (error) {
      console.error('Error during duplicate cleanup:', error);
      alert('Error cleaning up duplicate categories. Please try again.');
    }
  }
} 