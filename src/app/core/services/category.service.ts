import { Injectable } from '@angular/core';
import { Category } from '../models/category.model';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class CategoryService {

  constructor(private firebaseService: FirebaseService) {
    this.initializeDefaultCategories();
  }

  private async initializeDefaultCategories() {
    const categories = await this.firebaseService.loadCategories();
    if (categories.length === 0) {
      // Add default categories if none exist
      const defaultCategories = this.getDefaultCategories();
      for (const category of defaultCategories) {
        await this.firebaseService.addCategory(category);
      }
    }
  }

  async forceInitializeDefaultCategories(): Promise<void> {
    console.log('Force initializing default categories...');
    const defaultCategories = this.getDefaultCategories();
    for (const category of defaultCategories) {
      await this.firebaseService.addCategory(category);
    }
    console.log('Default categories initialized successfully');
  }

  private getDefaultCategories(): Omit<Category, 'id'>[] {
    return [
      {
        name: 'Food & Dining',
        color: '#A62C2C',
        icon: '🍕'
      },
      {
        name: 'Transportation',
        color: '#E83F25',
        icon: '🚙'
      },
      {
        name: 'Shopping',
        color: '#EA7300',
        icon: '🛒'
      },
      {
        name: 'Entertainment',
        color: '#D3CA79',
        icon: '🎭'
      },
      {
        name: 'Bills & Utilities',
        color: '#FF6B6B',
        icon: '⚡'
      },
      {
        name: 'Healthcare',
        color: '#4ECDC4',
        icon: '🏥'
      },
      {
        name: 'Education',
        color: '#45B7D1',
        icon: '🎓'
      },
      {
        name: 'Rent/Mortgage',
        color: '#96CEB4',
        icon: '🏘️'
      },
      {
        name: 'Insurance',
        color: '#FF8E53',
        icon: '🛡️'
      },
      {
        name: 'Savings',
        color: '#2ECC71',
        icon: '💎'
      },
      {
        name: 'Travel',
        color: '#9B59B6',
        icon: '✈️'
      },
      {
        name: 'Fitness & Sports',
        color: '#E74C3C',
        icon: '🏃'
      },
      {
        name: 'Personal Care',
        color: '#F39C12',
        icon: '💄'
      },
      {
        name: 'Gifts & Donations',
        color: '#E91E63',
        icon: '🎁'
      },
      {
        name: 'Technology',
        color: '#34495E',
        icon: '💻'
      },
      {
        name: 'Pet Care',
        color: '#8E44AD',
        icon: '🐕'
      },
      {
        name: 'Other',
        color: '#95A5A6',
        icon: '📌'
      }
    ];
  }

  async getAll(): Promise<Category[]> {
    // Simply call Firebase service directly - no caching
    const categories = await this.firebaseService.loadCategories();
    
    // Remove duplicates based on name (case-insensitive)
    const uniqueCategories = this.removeDuplicateCategories(categories);
    
    // If we found duplicates, update the Firebase collection
    if (uniqueCategories.length !== categories.length) {
      console.log(`Found ${categories.length - uniqueCategories.length} duplicate categories. Cleaning up...`);
      await this.cleanupDuplicateCategories(uniqueCategories);
    }
    
    return uniqueCategories;
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
      
      // Categories will be reloaded on next getAll() call
    } catch (error) {
      console.error('Error cleaning up duplicate categories:', error);
    }
  }

  async add(category: Omit<Category, 'id'>): Promise<string> {
    try {
      const id = await this.firebaseService.addCategory(category);
      return id;
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  }

  async update(category: Category): Promise<void> {
    try {
      console.log(`Updating category with ID: ${category.id}`);
      await this.firebaseService.updateCategory(category);
      console.log('Category updated successfully');
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      console.log(`Deleting category with ID: ${id}`);
      
      // Delete all expenses associated with this category first
      const expenses = await this.firebaseService.loadExpenses();
      const expensesToDelete = expenses.filter(e => e.categoryId === id);
      console.log(`Found ${expensesToDelete.length} expenses to delete for category ${id}`);
      
      for (const expense of expensesToDelete) {
        await this.firebaseService.deleteExpense(expense.id);
      }
      
      await this.firebaseService.deleteCategory(id);
      console.log('Category deleted successfully');
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

  async updateCategoryIcons(): Promise<number> {
    console.log('Updating category icons...');
    const categories = await this.getAll();
    
    // Define the new icon mappings
    const iconMappings: { [key: string]: string } = {
      'Food & Dining': '🍕',
      'Transportation': '🚙',
      'Shopping': '🛒',
      'Entertainment': '🎭',
      'Bills & Utilities': '⚡',
      'Healthcare': '🏥',
      'Education': '🎓',
      'Rent/Mortgage': '🏘️',
      'Insurance': '🛡️',
      'Savings': '💎',
      'Travel': '✈️',
      'Fitness & Sports': '🏃',
      'Personal Care': '💄',
      'Gifts & Donations': '🎁',
      'Technology': '💻',
      'Pet Care': '🐕',
      'Movie': '🎬',
      'Loan': '💳',
      'SIP': '📈',
      'Street food': '🌮',
      'Snooker': '🎱',
      'Tax': '📊',
      'Trips': '🧳',
      'EMI': '🏦',
      'Fuel': '⛽',
      'Office canteen': '🍽️',
    };

    let updatedCount = 0;
    
    for (const category of categories) {
      console.log(`Checking category: "${category.name}" with current icon: "${category.icon}"`);
      const newIcon = iconMappings[category.name];
      if (newIcon && category.icon !== newIcon) {
        try {
          const updatedCategory: Category = {
            ...category,
            icon: newIcon
          };
          await this.update(updatedCategory);
          updatedCount++;
          console.log(`✅ Updated icon for "${category.name}" from "${category.icon}" to "${newIcon}"`);
        } catch (error) {
          console.error(`❌ Error updating icon for "${category.name}":`, error);
        }
      } else if (newIcon) {
        console.log(`⏭️ Category "${category.name}" already has the correct icon: "${category.icon}"`);
      } else {
        console.log(`❓ No icon mapping found for category: "${category.name}"`);
      }
    }
    
    console.log(`Updated ${updatedCount} category icons`);
    return updatedCount;
  }
} 