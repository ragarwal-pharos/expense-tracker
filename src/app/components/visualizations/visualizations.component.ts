import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';
import { LoadingComponent } from '../../shared/components/loading/loading.component';

@Component({
  selector: 'app-visualizations',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingComponent],
  templateUrl: './visualizations.component.html',
  styleUrls: ['./visualizations.component.scss']
})
export class VisualizationsComponent implements OnInit, OnDestroy {
  expenses: Expense[] = [];
  categories: Category[] = [];
  isLoading = true;
  selectedPeriod = 'month';
  selectedCategory = 'all';

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  async loadData() {
    try {
      this.isLoading = true;
      
      // Load expenses and categories in parallel
      const [expenses, categories] = await Promise.all([
        this.expenseService.getAll(),
        this.categoryService.getAll()
      ]);
      
      this.expenses = expenses;
      this.categories = categories;
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  getFilteredExpenses(): Expense[] {
    let filtered = [...this.expenses];
    
    // Filter by period
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    if (this.selectedPeriod === 'month') {
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === currentMonth && 
               expenseDate.getFullYear() === currentYear;
      });
    } else if (this.selectedPeriod === 'year') {
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getFullYear() === currentYear;
      });
    }
    
    // Filter by category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(expense => expense.categoryId === this.selectedCategory);
    }
    
    return filtered;
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown';
  }

  getTotalAmount(): number {
    return this.getFilteredExpenses().reduce((total, expense) => total + expense.amount, 0);
  }

  getExpensesByCategory(): { category: string; amount: number; percentage: number }[] {
    const filtered = this.getFilteredExpenses();
    const total = this.getTotalAmount();
    
    const categoryMap = new Map<string, number>();
    
    filtered.forEach(expense => {
      const categoryName = this.getCategoryName(expense.categoryId);
      const current = categoryMap.get(categoryName) || 0;
      categoryMap.set(categoryName, current + expense.amount);
    });
    
    return Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  getMonthlyTrend(): { month: string; amount: number }[] {
    const now = new Date();
    const months = [];
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      const monthExpenses = this.expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === date.getMonth() && 
               expenseDate.getFullYear() === date.getFullYear();
      });
      
      const total = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      
      months.push({
        month: monthName,
        amount: total
      });
    }
    
    return months;
  }

  getTopExpenses(limit: number = 5): Expense[] {
    return this.getFilteredExpenses()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  getCategoryColor(index: number): string {
    const colors = [
      '#667eea', '#764ba2', '#f093fb', '#f5576c',
      '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
      '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
    ];
    return colors[index % colors.length];
  }

  getBarHeight(amount: number): number {
    const maxAmount = Math.max(...this.getMonthlyTrend().map(m => m.amount));
    return maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
  }
}
