import { Injectable } from '@angular/core';
import { FirebaseService } from './firebase.service';

@Injectable({
  providedIn: 'root'
})
export class DefaultCategoriesService {
  constructor(private firebaseService: FirebaseService) {}

  // Create default categories for new users
  async createDefaultCategories() {
    const defaultCategories = [
      { name: 'Food & Dining', color: '#ff6b9d', icon: '🍕' },
      { name: 'Transportation', color: '#4ecdc4', icon: '🚗' },
      { name: 'Shopping', color: '#45b7d1', icon: '🛍️' },
      { name: 'Entertainment', color: '#96ceb4', icon: '🎬' },
      { name: 'Healthcare', color: '#feca57', icon: '🏥' },
      { name: 'Utilities', color: '#ff9ff3', icon: '💡' },
      { name: 'Education', color: '#54a0ff', icon: '📚' },
      { name: 'Travel', color: '#5f27cd', icon: '✈️' },
      { name: 'Gifts', color: '#ff6348', icon: '🎁' },
      { name: 'Other', color: '#95a5a6', icon: '📌' }
    ];

    try {
      for (const category of defaultCategories) {
        await this.firebaseService.addCategory(category);
      }
      console.log('Default categories created successfully');
    } catch (error) {
      console.error('Error creating default categories:', error);
    }
  }
} 