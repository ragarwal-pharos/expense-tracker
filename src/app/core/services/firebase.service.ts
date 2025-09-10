import { Injectable, inject } from '@angular/core';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  DocumentData,
  QuerySnapshot,
  setDoc
} from 'firebase/firestore';
import { Firestore } from '@angular/fire/firestore';
import { Expense } from '../models/expense.model';
import { Category } from '../models/category.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private firestore = inject(Firestore);
  private expensesSubject = new BehaviorSubject<Expense[]>([]);
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  private userSettingsSubject = new BehaviorSubject<any>({});
  private loadingSubject = new BehaviorSubject<boolean>(false);
  
  // Store unsubscribe functions for real-time listeners
  private expensesUnsubscribe?: () => void;
  private categoriesUnsubscribe?: () => void;

  public expenses$ = this.expensesSubject.asObservable();
  public categories$ = this.categoriesSubject.asObservable();
  public userSettings$ = this.userSettingsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(private authService: AuthService) {
    // Subscribe to auth state changes to reload data when user changes
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        // Only load data if we don't have any data yet (first time login)
        const hasData = this.expensesSubject.value.length > 0 || this.categoriesSubject.value.length > 0;
        if (!hasData) {
          this.loadData();
        } else {
          // If we have data, just set up real-time listeners
          this.setupRealTimeListeners();
        }
      } else {
        // Clear data when user logs out
        this.cleanupListeners();
        this.expensesSubject.next([]);
        this.categoriesSubject.next([]);
        this.userSettingsSubject.next({});
      }
    });
  }

  // Load all data from Firebase
  private async loadData() {
    this.loadingSubject.next(true);
    try {
      await Promise.all([
        this.loadExpenses(),
        this.loadCategories(),
        this.loadUserSettings()
      ]);
      
      // Set up real-time listeners for automatic updates
      this.setupRealTimeListeners();
    } finally {
      this.loadingSubject.next(false);
    }
  }

  // Set up real-time listeners
  private setupRealTimeListeners() {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    // Clean up existing listeners first
    this.cleanupListeners();

    // Set up real-time listener for expenses
    const expensesRef = collection(this.firestore, 'expenses');
    const expensesQuery = query(
      expensesRef, 
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    
    this.expensesUnsubscribe = onSnapshot(expensesQuery, (querySnapshot) => {
      const expenses: Expense[] = [];
      querySnapshot.forEach((doc) => {
        expenses.push({ id: doc.id, ...doc.data() } as Expense);
      });
      this.expensesSubject.next(expenses);
      console.log(`Real-time update: ${expenses.length} expenses`);
    });

    // Set up real-time listener for categories
    const categoriesRef = collection(this.firestore, 'categories');
    const categoriesQuery = query(categoriesRef, where('userId', '==', userId));
    
    this.categoriesUnsubscribe = onSnapshot(categoriesQuery, (querySnapshot) => {
      const categories: Category[] = [];
      querySnapshot.forEach((doc) => {
        categories.push({ id: doc.id, ...doc.data() } as Category);
      });
      this.categoriesSubject.next(categories);
      console.log(`Real-time update: ${categories.length} categories`);
    });
  }

  // Clean up real-time listeners
  private cleanupListeners() {
    if (this.expensesUnsubscribe) {
      this.expensesUnsubscribe();
      this.expensesUnsubscribe = undefined;
    }
    if (this.categoriesUnsubscribe) {
      this.categoriesUnsubscribe();
      this.categoriesUnsubscribe = undefined;
    }
  }

  // Expenses Operations
  async loadExpenses(): Promise<Expense[]> {
    try {
      const userId = this.authService.getCurrentUserId();
      
      if (!userId) {
        this.expensesSubject.next([]);
        return [];
      }

      const expensesRef = collection(this.firestore, 'expenses');
      const q = query(
        expensesRef, 
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const expenses: Expense[] = [];
      querySnapshot.forEach((doc) => {
        expenses.push({ id: doc.id, ...doc.data() } as Expense);
      });
      
      this.expensesSubject.next(expenses);
      return expenses;
    } catch (error) {
      console.error('Error loading expenses:', error);
      return [];
    }
  }

  async addExpense(expense: Omit<Expense, 'id'>): Promise<string> {
    try {
      const userId = this.authService.getCurrentUserId();
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const expensesRef = collection(this.firestore, 'expenses');
      const expenseWithUserId = { 
        ...expense, 
        userId,
        createdAt: new Date().toISOString() // Add creation timestamp
      };
      
      const docRef = await addDoc(expensesRef, expenseWithUserId);
      
      // Real-time listener will automatically update the cache
      // No need to manually update cache here to avoid duplicates
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  }

  async updateExpense(expense: Expense): Promise<void> {
    try {
      const userId = this.authService.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      console.log(`Attempting to update expense with ID: ${expense.id}`);
      const expenseRef = doc(this.firestore, 'expenses', expense.id);
      
      // Check if document exists first
      const docSnap = await getDoc(expenseRef);
      if (!docSnap.exists()) {
        console.warn(`Document with ID ${expense.id} does not exist in Firebase. This might be a local-only expense.`);
        // For updates, we'll create the document if it doesn't exist
        const { id, ...expenseData } = expense;
        const expenseWithUserId = { ...expenseData, userId };
        await setDoc(expenseRef, expenseWithUserId);
        console.log(`Created new expense with ID: ${expense.id}`);
      } else {
        const { id, ...expenseData } = expense; // Remove id from the update data
        const expenseWithUserId = { ...expenseData, userId };
        await updateDoc(expenseRef, expenseWithUserId);
        console.log(`Expense ${expense.id} updated successfully`);
      }
      
      // Real-time listener will automatically update the cache
      // No need to manually update cache here to avoid duplicates
      
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  async deleteExpense(expenseId: string): Promise<void> {
    try {
      console.log(`Attempting to delete expense with ID: ${expenseId}`);
      const expenseRef = doc(this.firestore, 'expenses', expenseId);
      
      // Delete the document directly - Firebase handles non-existent documents gracefully
      await deleteDoc(expenseRef);
      console.log(`Expense ${expenseId} deleted successfully`);
      
      // Real-time listener will automatically update the cache
      // No need to manually update cache here to avoid duplicates
      
    } catch (error) {
      console.error('Error deleting expense:', error);
      // Don't throw error for non-existent documents
      if (error instanceof Error && error.message && error.message.includes('does not exist')) {
        console.warn('Document not found - likely a local-only expense');
        return;
      }
      throw error;
    }
  }

  // Helper method to migrate local expenses to Firebase
  async migrateLocalExpenses(localExpenses: any[]): Promise<void> {
    try {
      console.log('Starting migration of local expenses to Firebase...');
      
      for (const expense of localExpenses) {
        // Skip if expense already has a Firebase ID (starts with Firebase-generated pattern)
        if (expense.id && expense.id.length > 20) {
          console.log(`Expense ${expense.id} already migrated, skipping...`);
          continue;
        }
        
        // Create new expense in Firebase
        const { id, ...expenseData } = expense;
        const newId = await this.addExpense(expenseData);
        console.log(`Migrated expense from local ID ${id} to Firebase ID ${newId}`);
      }
      
      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Error during migration:', error);
      throw error;
    }
  }

  // Helper method to check if an ID is Firebase-generated
  isFirebaseId(id: string): boolean {
    return Boolean(id && id.length > 20); // Firebase IDs are typically 20+ characters
  }

  // Categories Operations
  async loadCategories(): Promise<Category[]> {
    try {
      const userId = this.authService.getCurrentUserId();
      if (!userId) {
        console.log('No user authenticated, returning empty categories');
        this.categoriesSubject.next([]);
        return [];
      }

      const categoriesRef = collection(this.firestore, 'categories');
      const q = query(categoriesRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const categories: Category[] = [];
      querySnapshot.forEach((doc) => {
        categories.push({ id: doc.id, ...doc.data() } as Category);
      });
      
      this.categoriesSubject.next(categories);
      return categories;
    } catch (error) {
      console.error('Error loading categories:', error);
      return [];
    }
  }

  async addCategory(category: Omit<Category, 'id'>): Promise<string> {
    try {
      const userId = this.authService.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const categoriesRef = collection(this.firestore, 'categories');
      const categoryWithUserId = { ...category, userId };
      const docRef = await addDoc(categoriesRef, categoryWithUserId);
      
      // Real-time listener will automatically update the cache
      // No need to manually update cache here to avoid duplicates
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  }

  async updateCategory(category: Category): Promise<void> {
    try {
      const userId = this.authService.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      console.log(`Attempting to update category with ID: ${category.id}`);
      const categoryRef = doc(this.firestore, 'categories', category.id);
      
      // Check if document exists first
      const docSnap = await getDoc(categoryRef);
      if (!docSnap.exists()) {
        console.warn(`Category with ID ${category.id} does not exist in Firebase. This might be a local-only category.`);
        // For icon updates, we'll create the document if it doesn't exist
        const { id, ...categoryData } = category;
        const categoryWithUserId = { ...categoryData, userId };
        await setDoc(categoryRef, categoryWithUserId);
        console.log(`Created new category with ID: ${category.id}`);
      } else {
        const { id, ...categoryData } = category; // Remove id from the update data
        const categoryWithUserId = { ...categoryData, userId };
        await updateDoc(categoryRef, categoryWithUserId);
        console.log(`Category ${category.id} updated successfully`);
      }
      
      // Real-time listener will automatically update the cache
      // No need to manually update cache here to avoid duplicates
      
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async deleteCategory(categoryId: string): Promise<void> {
    try {
      console.log(`Attempting to delete category with ID: ${categoryId} (length: ${categoryId.length})`);
      const categoryRef = doc(this.firestore, 'categories', categoryId);
      
      // Check if document exists first
      const docSnap = await getDoc(categoryRef);
      console.log(`Document exists: ${docSnap.exists()}`);
      
      if (!docSnap.exists()) {
        console.warn(`Category with ID ${categoryId} does not exist in Firebase. This might be a local-only category.`);
        // Don't throw error, just log warning and continue
        return;
      }
      
      console.log('Document found, proceeding with deletion...');
      await deleteDoc(categoryRef);
      console.log(`Category ${categoryId} deleted successfully`);
      
      // Real-time listener will automatically update the cache
      // No need to manually update cache here to avoid duplicates
      
    } catch (error) {
      console.error('Error deleting category:', error);
      // Don't throw error for non-existent documents
      if (error instanceof Error && error.message.includes('does not exist')) {
        console.warn('Category not found - likely a local-only category');
        // Real-time listener will handle the update
        return;
      }
      throw error;
    }
  }

  // User Settings Operations
  async loadUserSettings(): Promise<any> {
    try {
      const settingsRef = doc(this.firestore, 'userSettings', 'default');
      const docSnap = await getDoc(settingsRef);
      
      if (docSnap.exists()) {
        const settings = docSnap.data();
        this.userSettingsSubject.next(settings);
        return settings;
      } else {
        // Create default settings using setDoc instead of updateDoc
        const defaultSettings = {
          budgetLimit: 0,
          emergencyFund: 0,
          vacationFund: 0,
          theme: 'light',
          currency: '₹'
        };
        await this.saveUserSettings(defaultSettings);
        return defaultSettings;
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
      return {
        budgetLimit: 0,
        emergencyFund: 0,
        vacationFund: 0,
        theme: 'light',
        currency: '₹'
      };
    }
  }

  async saveUserSettings(settings: any): Promise<void> {
    try {
      const settingsRef = doc(this.firestore, 'userSettings', 'default');
      // Use setDoc with merge option instead of updateDoc
      await setDoc(settingsRef, settings, { merge: true });
      
      this.userSettingsSubject.next(settings);
    } catch (error) {
      console.error('Error saving user settings:', error);
      throw error;
    }
  }


  // Utility methods
  async getExpensesByCategory(categoryId: string): Promise<Expense[]> {
    try {
      const userId = this.authService.getCurrentUserId();
      if (!userId) return [];

      const expensesRef = collection(this.firestore, 'expenses');
      const q = query(
        expensesRef, 
        where('userId', '==', userId),
        where('categoryId', '==', categoryId)
      );
      const querySnapshot = await getDocs(q);
      
      const expenses: Expense[] = [];
      querySnapshot.forEach((doc) => {
        expenses.push({ id: doc.id, ...doc.data() } as Expense);
      });
      
      return expenses;
    } catch (error) {
      console.error('Error getting expenses by category:', error);
      return [];
    }
  }

  async getExpensesByDateRange(startDate: string, endDate: string): Promise<Expense[]> {
    try {
      const userId = this.authService.getCurrentUserId();
      if (!userId) return [];

      const expensesRef = collection(this.firestore, 'expenses');
      const q = query(
        expensesRef, 
        where('userId', '==', userId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const expenses: Expense[] = [];
      querySnapshot.forEach((doc) => {
        expenses.push({ id: doc.id, ...doc.data() } as Expense);
      });
      
      return expenses;
    } catch (error) {
      console.error('Error getting expenses by date range:', error);
      return [];
    }
  }
} 