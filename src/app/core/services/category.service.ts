import { Injectable } from '@angular/core';
import { Category } from '../models/category.model';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private categories: Category[] = [];

  constructor(private firebaseService: FirebaseService) {
    this.loadCategories();
    this.initializeDefaultCategories();
  }

  private async loadCategories() {
    try {
      console.log('Loading categories from Firebase...');
      this.categories = await this.firebaseService.loadCategories();
      console.log(`Loaded ${this.categories.length} categories from Firebase`);
    } catch (error) {
      console.error('Error loading categories:', error);
      this.categories = [];
      // Return empty array instead of throwing to prevent app crashes
    }
  }

  private async initializeDefaultCategories() {
    const categories = await this.firebaseService.loadCategories();
    if (categories.length === 0) {
      // Add default categories if none exist
      const defaultCategories = this.getDefaultCategories();
      for (const category of defaultCategories) {
        await this.firebaseService.addCategory(category);
      }
      await this.loadCategories(); // Reload after adding defaults
    }
  }

  async forceInitializeDefaultCategories(): Promise<void> {
    console.log('Force initializing default categories...');
    const defaultCategories = this.getDefaultCategories();
    for (const category of defaultCategories) {
      await this.firebaseService.addCategory(category);
    }
    await this.loadCategories(); // Reload after adding defaults
    console.log('Default categories initialized successfully');
  }

  private getDefaultCategories(): Omit<Category, 'id'>[] {
    return [
      {
        name: 'Food & Dining',
        color: '#A62C2C',
        icon: '🍽️'
      },
      {
        name: 'Transportation',
        color: '#E83F25',
        icon: '🚗'
      },
      {
        name: 'Shopping',
        color: '#EA7300',
        icon: '🛍️'
      },
      {
        name: 'Entertainment',
        color: '#D3CA79',
        icon: '🎬'
      },
      {
        name: 'Bills & Utilities',
        color: '#FF6B6B',
        icon: '💡'
      },
      {
        name: 'Healthcare',
        color: '#4ECDC4',
        icon: '🏥'
      },
      {
        name: 'Education',
        color: '#45B7D1',
        icon: '📚'
      },
      {
        name: 'Rent/Mortgage',
        color: '#96CEB4',
        icon: '🏠'
      },
      {
        name: 'Insurance',
        color: '#FF8E53',
        icon: '🛡️'
      },
      {
        name: 'Savings',
        color: '#2ECC71',
        icon: '💰'
      }
    ];
  }

  async getAll(): Promise<Category[]> {
    // Always reload from Firebase to ensure fresh data
    await this.loadCategories();
    
    // Remove duplicates based on name (case-insensitive)
    const uniqueCategories = this.removeDuplicateCategories(this.categories);
    
    // If we found duplicates, update the Firebase collection
    if (uniqueCategories.length !== this.categories.length) {
      console.log(`Found ${this.categories.length - uniqueCategories.length} duplicate categories. Cleaning up...`);
      await this.cleanupDuplicateCategories(uniqueCategories);
    }
    
    return [...uniqueCategories];
  }

  private removeDuplicateCategories(categories: Category[]): Category[] {
    const seen = new Set<string>();
    const uniqueCategories: Category[] = [];
    
    for (const category of categories) {
      const normalizedName = category.name.toLowerCase().trim();
      if (!seen.has(normalizedName)) {
        seen.add(normalizedName);
        uniqueCategories.push(category);
      } else {
        console.log(`Duplicate category found: "${category.name}" (ID: ${category.id})`);
      }
    }
    
    return uniqueCategories;
  }

  private async cleanupDuplicateCategories(uniqueCategories: Category[]): Promise<void> {
    try {
      // Get all categories from Firebase
      const allCategories = await this.firebaseService.loadCategories();
      
      // Find duplicates to delete
      const seen = new Set<string>();
      const duplicatesToDelete: string[] = [];
      
      for (const category of allCategories) {
        const normalizedName = category.name.toLowerCase().trim();
        if (seen.has(normalizedName)) {
          duplicatesToDelete.push(category.id);
          console.log(`Marking duplicate for deletion: "${category.name}" (ID: ${category.id})`);
        } else {
          seen.add(normalizedName);
        }
      }
      
      // Delete duplicates from Firebase
      for (const duplicateId of duplicatesToDelete) {
        try {
          await this.firebaseService.deleteCategory(duplicateId);
          console.log(`Deleted duplicate category with ID: ${duplicateId}`);
        } catch (error) {
          console.error(`Error deleting duplicate category ${duplicateId}:`, error);
        }
      }
      
      // Reload categories after cleanup
      await this.loadCategories();
    } catch (error) {
      console.error('Error cleaning up duplicate categories:', error);
    }
  }

  async add(category: Omit<Category, 'id'>): Promise<string> {
    try {
      const id = await this.firebaseService.addCategory(category);
      await this.loadCategories(); // Reload from Firebase
      return id;
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  }

  async update(category: Category): Promise<void> {
    try {
      console.log(`Updating category with ID: ${category.id} (length: ${category.id.length})`);
      
      // Check if this is a local ID (short) vs Firebase ID (long)
      if (category.id.length < 20) {
        console.warn(`Attempting to update local category with ID: ${category.id}. This category may not exist in Firebase.`);
        // For local IDs, we'll try to update but won't fail if it doesn't exist
        try {
          await this.firebaseService.updateCategory(category);
        } catch (error) {
          if (error instanceof Error && error.message.includes('does not exist')) {
            console.warn('Local category not found in Firebase - this is expected for old local data');
            // Remove from local cache
            this.categories = this.categories.filter(c => c.id !== category.id);
            return;
          }
          throw error;
        }
      } else {
        console.log('Updating Firebase category...');
        await this.firebaseService.updateCategory(category);
      }
      
      console.log('Category updated successfully');
      await this.loadCategories(); // Reload from Firebase
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      console.log(`Deleting category with ID: ${id} (length: ${id.length})`);
      
      // Check if this is a local ID (short) vs Firebase ID (long)
      if (id.length < 20) {
        console.warn(`Attempting to delete local category with ID: ${id}. This category may not exist in Firebase.`);
        // For local IDs, we'll try to delete but won't fail if it doesn't exist
        try {
          // Delete all expenses associated with this category first
          const expenses = await this.firebaseService.loadExpenses();
          const expensesToDelete = expenses.filter(e => e.categoryId === id);
          console.log(`Found ${expensesToDelete.length} expenses to delete for category ${id}`);
          
          for (const expense of expensesToDelete) {
            await this.firebaseService.deleteExpense(expense.id);
          }
          
          await this.firebaseService.deleteCategory(id);
        } catch (error) {
          if (error instanceof Error && error.message.includes('does not exist')) {
            console.warn('Local category not found in Firebase - this is expected for old local data');
            // Remove from local cache
            this.categories = this.categories.filter(c => c.id !== id);
            return;
          }
          throw error;
        }
      } else {
        console.log('Deleting Firebase category...');
        // Delete all expenses associated with this category first
        const expenses = await this.firebaseService.loadExpenses();
        const expensesToDelete = expenses.filter(e => e.categoryId === id);
        console.log(`Found ${expensesToDelete.length} expenses to delete for category ${id}`);
        
        for (const expense of expensesToDelete) {
          await this.firebaseService.deleteExpense(expense.id);
        }
        
        await this.firebaseService.deleteCategory(id);
      }
      
      console.log('Category deleted successfully');
      await this.loadCategories(); // Reload from Firebase
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Category | undefined> {
    const categories = await this.firebaseService.loadCategories();
    return categories.find(c => c.id === id);
  }

  async triggerDuplicateCleanup(): Promise<void> {
    console.log('Manual duplicate cleanup triggered...');
    const categories = await this.getAll();
    console.log(`Categories after cleanup: ${categories.length}`);
  }
} 