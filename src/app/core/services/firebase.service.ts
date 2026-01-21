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
import { Trade } from '../models/trade.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private firestore = inject(Firestore);
  private expensesSubject = new BehaviorSubject<Expense[]>([]);
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  private tradesSubject = new BehaviorSubject<Trade[]>([]);
  private userSettingsSubject = new BehaviorSubject<any>({});
  private loadingSubject = new BehaviorSubject<boolean>(false);
  
  // Store unsubscribe functions for real-time listeners
  private expensesUnsubscribe?: () => void;
  private categoriesUnsubscribe?: () => void;
  private tradesUnsubscribe?: () => void;

  public expenses$ = this.expensesSubject.asObservable();
  public categories$ = this.categoriesSubject.asObservable();
  public trades$ = this.tradesSubject.asObservable();
  public userSettings$ = this.userSettingsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(private authService: AuthService) {
    // Subscribe to auth state changes to reload data when user changes
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        // Only load data if we don't have any data yet (first time login)
        // Note: Trades are independent from expenses/categories and load separately
        const hasData = this.expensesSubject.value.length > 0 || this.categoriesSubject.value.length > 0;
        if (!hasData) {
          this.loadData();
        } else {
          // If we have data, just set up real-time listeners
          // This ensures trades are loaded even if expenses/categories already exist
          this.setupRealTimeListeners();
          // Also load trades to ensure they're available immediately
          this.loadTrades();
        }
      } else {
        // Clear data when user logs out
        this.cleanupListeners();
        this.expensesSubject.next([]);
        this.categoriesSubject.next([]);
        this.tradesSubject.next([]);
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
        this.loadTrades(),
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
    });

    // Set up real-time listener for trades
    const tradesRef = collection(this.firestore, 'trades');
    const tradesQuery = query(
      tradesRef, 
      where('userId', '==', userId)
      // Note: Removed orderBy to avoid requiring composite index
      // Sorting is done in memory instead
    );
    
    this.tradesUnsubscribe = onSnapshot(tradesQuery, (querySnapshot) => {
      const trades: Trade[] = [];
      querySnapshot.forEach((doc) => {
        const tradeData = doc.data() as any;
        // Ensure isProfit is properly converted to boolean
        const isProfitValue = tradeData['isProfit'];
        const isProfit = isProfitValue !== undefined 
          ? (typeof isProfitValue === 'boolean' ? isProfitValue : isProfitValue === true || isProfitValue === 'true')
          : true;
        
        trades.push({ 
          id: doc.id, 
          ...tradeData,
          amount: tradeData['amount'] || 0,
          indexValue: tradeData['indexValue'] || 0,
          isProfit: isProfit
        } as Trade);
      });
      
      // Sort by date descending in memory
      trades.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA; // Descending order
      });
      this.tradesSubject.next(trades);
    }, (error) => {
      console.error('Error in trades snapshot listener:', error);
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
    if (this.tradesUnsubscribe) {
      this.tradesUnsubscribe();
      this.tradesUnsubscribe = undefined;
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

      const expenseRef = doc(this.firestore, 'expenses', expense.id);
      
      // Check if document exists first
      const docSnap = await getDoc(expenseRef);
      if (!docSnap.exists()) {
        console.warn(`Document with ID ${expense.id} does not exist in Firebase. This might be a local-only expense.`);
        // For updates, we'll create the document if it doesn't exist
        const { id, ...expenseData } = expense;
        const expenseWithUserId = { ...expenseData, userId };
        await setDoc(expenseRef, expenseWithUserId);
      } else {
        const { id, ...expenseData } = expense; // Remove id from the update data
        const expenseWithUserId = { ...expenseData, userId };
        await updateDoc(expenseRef, expenseWithUserId);
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
      const expenseRef = doc(this.firestore, 'expenses', expenseId);
      
      // Delete the document directly - Firebase handles non-existent documents gracefully
      await deleteDoc(expenseRef);
      
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
      for (const expense of localExpenses) {
        // Skip if expense already has a Firebase ID (starts with Firebase-generated pattern)
        if (expense.id && expense.id.length > 20) {
          continue;
        }
        
        // Create new expense in Firebase
        const { id, ...expenseData } = expense;
        await this.addExpense(expenseData);
      }
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

      const categoryRef = doc(this.firestore, 'categories', category.id);
      
      // Check if document exists first
      const docSnap = await getDoc(categoryRef);
      if (!docSnap.exists()) {
        console.warn(`Category with ID ${category.id} does not exist in Firebase. This might be a local-only category.`);
        // For icon updates, we'll create the document if it doesn't exist
        const { id, ...categoryData } = category;
        const categoryWithUserId = { ...categoryData, userId };
        await setDoc(categoryRef, categoryWithUserId);
      } else {
        const { id, ...categoryData } = category; // Remove id from the update data
        const categoryWithUserId = { ...categoryData, userId };
        await updateDoc(categoryRef, categoryWithUserId);
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
      const categoryRef = doc(this.firestore, 'categories', categoryId);
      
      // Check if document exists first
      const docSnap = await getDoc(categoryRef);
      
      if (!docSnap.exists()) {
        // Don't throw error, just return
        return;
      }
      
      await deleteDoc(categoryRef);
      
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

  // Trades Operations
  async loadTrades(): Promise<Trade[]> {
    try {
      const userId = this.authService.getCurrentUserId();
      
      if (!userId) {
        this.tradesSubject.next([]);
        return [];
      }

      // Ensure real-time listener is set up if not already
      if (!this.tradesUnsubscribe) {
        this.setupRealTimeListeners();
      }

      const tradesRef = collection(this.firestore, 'trades');
      const q = query(
        tradesRef, 
        where('userId', '==', userId)
        // Note: Removed orderBy to avoid requiring composite index
        // Sorting is done in memory instead
      );
      const querySnapshot = await getDocs(q);
      
      const trades: Trade[] = [];
      querySnapshot.forEach((doc) => {
        const tradeData = doc.data() as any;
        // Ensure isProfit is properly converted to boolean
        const isProfitValue = tradeData['isProfit'];
        const isProfit = isProfitValue !== undefined 
          ? (typeof isProfitValue === 'boolean' ? isProfitValue : isProfitValue === true || isProfitValue === 'true')
          : true;
        
        trades.push({ 
          id: doc.id, 
          ...tradeData,
          isProfit: isProfit
        } as Trade);
      });
      
      // Sort by date descending in memory
      trades.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA; // Descending order
      });
      
      this.tradesSubject.next(trades);
      return trades;
    } catch (error) {
      console.error('Error loading trades:', error);
      return [];
    }
  }

  async addTrade(trade: Omit<Trade, 'id'>): Promise<string> {
    try {
      const userId = this.authService.getCurrentUserId();
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const tradesRef = collection(this.firestore, 'trades');
      const tradeWithUserId = { 
        ...trade, 
        userId,
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(tradesRef, tradeWithUserId);
      return docRef.id;
    } catch (error) {
      console.error('Error adding trade:', error);
      throw error;
    }
  }

  async updateTrade(trade: Trade): Promise<void> {
    try {
      const userId = this.authService.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const tradeRef = doc(this.firestore, 'trades', trade.id);
      const docSnap = await getDoc(tradeRef);
      if (!docSnap.exists()) {
        const { id, ...tradeData } = trade;
        const tradeWithUserId = { ...tradeData, userId };
        await setDoc(tradeRef, tradeWithUserId);
      } else {
        const { id, ...tradeData } = trade;
        const tradeWithUserId = { ...tradeData, userId };
        await updateDoc(tradeRef, tradeWithUserId);
      }
    } catch (error) {
      console.error('Error updating trade:', error);
      throw error;
    }
  }

  async deleteTrade(tradeId: string): Promise<void> {
    try {
      const tradeRef = doc(this.firestore, 'trades', tradeId);
      await deleteDoc(tradeRef);
    } catch (error) {
      console.error('Error deleting trade:', error);
      throw error;
    }
  }

  async getTradesByDateRange(startDate: string, endDate: string): Promise<Trade[]> {
    try {
      const userId = this.authService.getCurrentUserId();
      if (!userId) return [];

      const tradesRef = collection(this.firestore, 'trades');
      // Use only userId filter to avoid composite index requirement
      // Date filtering and sorting will be done in memory
      const q = query(
        tradesRef, 
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      
      const trades: Trade[] = [];
      querySnapshot.forEach((doc) => {
        const tradeData = doc.data() as any;
        // Ensure isProfit is properly converted to boolean
        const isProfitValue = tradeData['isProfit'];
        const isProfit = isProfitValue !== undefined 
          ? (typeof isProfitValue === 'boolean' ? isProfitValue : isProfitValue === true || isProfitValue === 'true')
          : true;
        
        const trade = { 
          id: doc.id, 
          ...tradeData,
          isProfit: isProfit
        } as Trade;
        // Filter by date range in memory
        if (trade.date >= startDate && trade.date <= endDate) {
          trades.push(trade);
        }
      });
      
      // Sort by date descending in memory
      trades.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA; // Descending order
      });
      
      return trades;
    } catch (error) {
      console.error('Error getting trades by date range:', error);
      return [];
    }
  }
} 