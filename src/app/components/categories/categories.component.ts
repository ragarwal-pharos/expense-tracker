import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../core/services/category.service';
import { ExpenseService } from '../../core/services/expense.service';
import { FirebaseService } from '../../core/services/firebase.service';
import { Category } from '../../core/models/category.model';
import { Expense } from '../../core/models/expense.model';
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
  expenses: Expense[] = [];
  newCategory: Category = {
    id: '',
    name: '',
    color: '#ff6b9d',
    icon: '📌'
  };

  // Enhanced filtering and search
  searchTerm: string = '';
  filterByUsage: 'all' | 'used' | 'unused' = 'all';
  sortBy: 'name' | 'usage' | 'color' = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';
  showAdvancedOptions: boolean = false;

  // Validation properties
  isDuplicateCategory: boolean = false;
  isEditMode: boolean = false;
  editingCategoryId: string = '';

  // Analytics
  totalCategories: number = 0;
  usedCategories: number = 0;
  unusedCategories: number = 0;
  mostUsedCategory: Category | null = null;
  leastUsedCategory: Category | null = null;

  private subscription: Subscription = new Subscription();

  constructor(
    private categoryService: CategoryService,
    private expenseService: ExpenseService,
    private firebaseService: FirebaseService
  ) {}

  ngOnInit() {
    // Subscribe to Firebase observables for real-time updates
    this.subscription.add(
      this.firebaseService.categories$.subscribe(categories => {
        this.categories = categories;
        this.calculateAnalytics();
        console.log(`Received ${categories.length} categories from Firebase`);
      })
    );

    this.subscription.add(
      this.firebaseService.expenses$.subscribe(expenses => {
        this.expenses = expenses;
        this.calculateAnalytics();
        console.log(`Received ${expenses.length} expenses from Firebase`);
      })
    );

    this.loadData();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  async loadData() {
    try {
      this.categories = await this.categoryService.getAll();
      this.expenses = await this.expenseService.getAll();
      this.calculateAnalytics();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  calculateAnalytics() {
    this.totalCategories = this.categories.length;
    
    // Calculate usage statistics
    const categoryUsage = this.getCategoryUsageStats();
    this.usedCategories = Object.keys(categoryUsage).length;
    this.unusedCategories = this.totalCategories - this.usedCategories;
    
    // Find most and least used categories
    if (Object.keys(categoryUsage).length > 0) {
      const sortedUsage = Object.entries(categoryUsage).sort((a, b) => b[1] - a[1]);
      this.mostUsedCategory = this.categories.find(cat => cat.id === sortedUsage[0][0]) || null;
      this.leastUsedCategory = this.categories.find(cat => cat.id === sortedUsage[sortedUsage.length - 1][0]) || null;
    }
  }

  getCategoryUsageStats(): { [key: string]: number } {
    const usage: { [key: string]: number } = {};
    
    // Count how many times each category is used in expenses
    this.expenses.forEach(expense => {
      if (expense.categoryId) {
        usage[expense.categoryId] = (usage[expense.categoryId] || 0) + 1;
      }
    });
    
    return usage;
  }

  async initializeDefaultCategories() {
    try {
      await this.categoryService.forceInitializeDefaultCategories();
      await this.loadData();
      alert('Default categories initialized successfully!');
    } catch (error) {
      console.error('Error initializing default categories:', error);
      alert('Error initializing default categories. Please try again.');
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
      
      this.resetForm();
      alert('Category added successfully!');
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Error adding category. Please try again.');
    }
  }

  async updateCategory(category: Category) {
    try {
      const newName = window.prompt('Enter new category name:', category.name);
      if (!newName || newName.trim() === '') {
        return;
      }

      const newColor = window.prompt('Enter new color (hex code):', category.color || '#ff6b9d');
      if (!newColor) {
        return;
      }

      const newIcon = window.prompt('Enter new icon (emoji):', category.icon || '📌');
      if (!newIcon) {
        return;
      }

      const updatedCategory: Category = {
        ...category,
        name: newName.trim(),
        color: newColor,
        icon: newIcon
      };

      await this.categoryService.update(updatedCategory);
      console.log('Category updated successfully');
      alert('Category updated successfully!');
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Error updating category. Please try again.');
    }
  }

  async deleteCategory(category: Category) {
    const confirmed = window.confirm(`Are you sure you want to delete "${category.name}"?\n\nThis will also remove all expenses in this category.`);
    if (!confirmed) return;

    try {
      await this.categoryService.delete(category.id);
      console.log('Category deleted successfully');
      alert('Category deleted successfully!');
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Error deleting category. Please try again.');
    }
  }

  confirmDelete(category: Category) {
    this.deleteCategory(category);
  }

  validateCategory(): boolean {
    if (!this.newCategory.name?.trim()) {
      alert('Please enter a category name.');
      return false;
    }

    // Check for duplicates
    const isDuplicate = this.categories.some(cat => 
      cat.name.toLowerCase().trim() === this.newCategory.name.toLowerCase().trim() &&
      cat.id !== this.editingCategoryId
    );

    if (isDuplicate) {
      this.isDuplicateCategory = true;
      alert('Category name already exists!');
      return false;
    }

    this.isDuplicateCategory = false;
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
    this.isEditMode = false;
    this.editingCategoryId = '';
    this.clearValidationErrors();
  }

  getFilteredCategories(): Category[] {
    let filtered = [...this.categories];
    
    // Search filter
    if (this.searchTerm) {
      filtered = filtered.filter(category => 
        category.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (category.icon || '').includes(this.searchTerm)
      );
    }
    
    // Usage filter
    if (this.filterByUsage !== 'all') {
      const usageStats = this.getCategoryUsageStats();
      if (this.filterByUsage === 'used') {
        filtered = filtered.filter(category => usageStats[category.id] > 0);
      } else if (this.filterByUsage === 'unused') {
        filtered = filtered.filter(category => !usageStats[category.id] || usageStats[category.id] === 0);
      }
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
          const usageStats = this.getCategoryUsageStats();
          aValue = usageStats[a.id] || 0;
          bValue = usageStats[b.id] || 0;
          break;
        case 'color':
          aValue = a.color || '';
          bValue = b.color || '';
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (this.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return filtered;
  }

  getCategoryUsage(categoryId: string): number {
    const usageStats = this.getCategoryUsageStats();
    return usageStats[categoryId] || 0;
  }

  clearSearch() {
    this.searchTerm = '';
  }

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getColorPresets(): string[] {
    return [
      '#ff6b9d', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
      '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
      '#ff6348', '#2ed573', '#1e90ff', '#ffa502', '#ff3838'
    ];
  }

  getIconPresets(): string[] {
    return [
      '📌', '🍔', '🚗', '🏠', '💊', '🎬', '🛒', '✈️', '🎓', '💻',
      '📱', '🎮', '🏋️', '🎨', '📚', '🎵', '🎪', '🏥', '💇', '💄'
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
    this.newCategory.color = colors[Math.floor(Math.random() * colors.length)];
  }

  setRandomIcon() {
    const icons = this.getIconPresets();
    this.newCategory.icon = icons[Math.floor(Math.random() * icons.length)];
  }

  getCategoryCount(): number {
    return this.categories.length;
  }

  getTotalCategories(): number {
    return this.categories.length;
  }

  getMostUsedCategory(): Category | null {
    return this.mostUsedCategory;
  }

  getLeastUsedCategory(): Category | null {
    return this.leastUsedCategory;
  }

  async cleanupDuplicates() {
    const confirmed = window.confirm('This will remove duplicate categories. Continue?');
    if (!confirmed) return;

    try {
      const uniqueCategories = this.categories.filter((category, index, self) => 
        index === self.findIndex(c => c.name.toLowerCase() === category.name.toLowerCase())
      );

      // Delete all categories and re-add unique ones
      for (const category of this.categories) {
        await this.categoryService.delete(category.id);
      }

      for (const category of uniqueCategories) {
        await this.categoryService.add({
          name: category.name,
          color: category.color || '#ff6b9d',
          icon: category.icon || '📌'
        });
      }

      alert('Duplicate categories cleaned up successfully!');
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      alert('Error cleaning up duplicates. Please try again.');
    }
  }

  getAnalyticsInsights(): any[] {
    const insights = [];
    
    if (this.mostUsedCategory) {
      insights.push({
        type: 'most-used',
        title: 'Most Used Category',
        value: this.mostUsedCategory.name,
        icon: this.mostUsedCategory.icon,
        color: this.mostUsedCategory.color
      });
    }
    
    if (this.leastUsedCategory) {
      insights.push({
        type: 'least-used',
        title: 'Least Used Category',
        value: this.leastUsedCategory.name,
        icon: this.leastUsedCategory.icon,
        color: this.leastUsedCategory.color
      });
    }
    
    insights.push({
      type: 'stats',
      title: 'Category Statistics',
      value: `${this.usedCategories} used, ${this.unusedCategories} unused`,
      icon: '📊'
    });
    
    return insights;
  }
} 