import { Injectable } from '@angular/core';
import { ExpenseService } from './expense.service';
import { CategoryService } from './category.service';
import { Expense } from '../models/expense.model';
import { Category } from '../models/category.model';

export interface SpendingPattern {
  category: Category;
  totalAmount: number;
  averageAmount: number;
  frequency: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  percentageOfTotal: number;
}

export interface SavingsOpportunity {
  category: Category;
  currentSpending: number;
  potentialSavings: number;
  suggestions: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface ActionableTip {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  actionLabel?: string;
  actionCallback?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class InsightsService {
  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService
  ) {}

  getSpendingPatterns(expenses: Expense[], categories: Category[]): SpendingPattern[] {
    const patterns: SpendingPattern[] = [];
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    categories.forEach(category => {
      const categoryExpenses = expenses.filter(e => e.categoryId === category.id);
      
      if (categoryExpenses.length > 0) {
        const totalAmount = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
        const averageAmount = totalAmount / categoryExpenses.length;
        const percentageOfTotal = (totalAmount / expenses.reduce((sum, e) => sum + e.amount, 0)) * 100;

        // Calculate trend (simplified)
        const sortedExpenses = categoryExpenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const firstHalf = sortedExpenses.slice(0, Math.floor(sortedExpenses.length / 2));
        const secondHalf = sortedExpenses.slice(Math.floor(sortedExpenses.length / 2));
        
        const firstHalfTotal = firstHalf.reduce((sum, e) => sum + e.amount, 0);
        const secondHalfTotal = secondHalf.reduce((sum, e) => sum + e.amount, 0);
        
        let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (secondHalfTotal > firstHalfTotal * 1.1) {
          trend = 'increasing';
        } else if (secondHalfTotal < firstHalfTotal * 0.9) {
          trend = 'decreasing';
        }

        patterns.push({
          category,
          totalAmount,
          averageAmount,
          frequency: categoryExpenses.length,
          trend,
          percentageOfTotal
        });
      }
    });

    return patterns.sort((a, b) => b.totalAmount - a.totalAmount);
  }

  getSavingsOpportunities(expenses: Expense[], categories: Category[]): SavingsOpportunity[] {
    const opportunities: SavingsOpportunity[] = [];
    const patterns = this.getSpendingPatterns(expenses, categories);

    patterns.forEach(pattern => {
      const suggestions: string[] = [];
      let potentialSavings = 0;
      let priority: 'high' | 'medium' | 'low' = 'low';

      // Analyze spending patterns and suggest savings
      if (pattern.percentageOfTotal > 30) {
        suggestions.push('This category represents a large portion of your spending. Consider reducing expenses here.');
        potentialSavings = pattern.totalAmount * 0.2; // 20% potential savings
        priority = 'high';
      }

      if (pattern.averageAmount > 1000) {
        suggestions.push('High average transaction amount. Look for bulk purchase opportunities or discounts.');
        potentialSavings += pattern.totalAmount * 0.15;
        priority = priority === 'high' ? 'high' : 'medium';
      }

      if (pattern.frequency > 10) {
        suggestions.push('Frequent small purchases. Consider consolidating or finding subscription alternatives.');
        potentialSavings += pattern.totalAmount * 0.1;
        priority = priority === 'high' ? 'high' : 'medium';
      }

      if (pattern.trend === 'increasing') {
        suggestions.push('Spending is increasing in this category. Review recent expenses to identify unnecessary purchases.');
        potentialSavings += pattern.totalAmount * 0.25;
        priority = 'high';
      }

      if (potentialSavings > 0) {
        opportunities.push({
          category: pattern.category,
          currentSpending: pattern.totalAmount,
          potentialSavings,
          suggestions,
          priority
        });
      }
    });

    return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  getActionableTips(expenses: Expense[], categories: Category[]): ActionableTip[] {
    const tips: ActionableTip[] = [];
    const patterns = this.getSpendingPatterns(expenses, categories);
    const opportunities = this.getSavingsOpportunities(expenses, categories);

    // Tip 1: High spending category
    const topSpending = patterns[0];
    if (topSpending && topSpending.percentageOfTotal > 40) {
      tips.push({
        id: 'high-spending',
        title: 'High Spending Alert',
        message: `${topSpending.category.name} accounts for ${topSpending.percentageOfTotal.toFixed(1)}% of your spending. Consider setting a budget limit for this category.`,
        category: 'budget',
        priority: 'high',
        actionable: true,
        actionLabel: 'Set Category Budget',
        actionCallback: () => {
          // TODO: Implement category budget setting
          console.log('Set category budget for', topSpending.category.name);
        }
      });
    }

    // Tip 2: Increasing trend
    const increasingCategories = patterns.filter(p => p.trend === 'increasing');
    if (increasingCategories.length > 0) {
      tips.push({
        id: 'increasing-trend',
        title: 'Spending Trend Alert',
        message: `${increasingCategories.length} category(ies) show increasing spending trends. Review your recent expenses in these categories.`,
        category: 'trend',
        priority: 'medium',
        actionable: true,
        actionLabel: 'Review Expenses',
        actionCallback: () => {
          // TODO: Navigate to expenses with filter
          console.log('Review expenses for increasing categories');
        }
      });
    }

    // Tip 3: Savings opportunity
    const topOpportunity = opportunities[0];
    if (topOpportunity && topOpportunity.potentialSavings > 1000) {
      tips.push({
        id: 'savings-opportunity',
        title: 'Savings Opportunity',
        message: `You could save ₹${topOpportunity.potentialSavings.toLocaleString()} by optimizing your ${topOpportunity.category.name} spending.`,
        category: 'savings',
        priority: 'high',
        actionable: true,
        actionLabel: 'View Suggestions',
        actionCallback: () => {
          // TODO: Show detailed savings suggestions
          console.log('Show savings suggestions for', topOpportunity.category.name);
        }
      });
    }

    // Tip 4: Budget adherence
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysElapsed = new Date().getDate();
    const projectedMonthly = (totalSpent / daysElapsed) * daysInMonth;

    if (projectedMonthly > 50000) {
      tips.push({
        id: 'high-projection',
        title: 'High Spending Projection',
        message: `Your projected monthly spending is ₹${projectedMonthly.toLocaleString()}. Consider reviewing your budget and spending habits.`,
        category: 'budget',
        priority: 'high',
        actionable: true,
        actionLabel: 'Review Budget',
        actionCallback: () => {
          // TODO: Navigate to budget settings
          console.log('Review budget settings');
        }
      });
    }

    // Tip 5: Category diversity
    if (patterns.length < 5) {
      tips.push({
        id: 'category-diversity',
        title: 'Improve Category Diversity',
        message: 'You\'re using only a few categories. Adding more categories helps better track and analyze your spending patterns.',
        category: 'organization',
        priority: 'medium',
        actionable: true,
        actionLabel: 'Add Categories',
        actionCallback: () => {
          // TODO: Navigate to categories page
          console.log('Navigate to categories page');
        }
      });
    }

    return tips.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  getFinancialHealthInsights(expenses: Expense[], categories: Category[]): any {
    const patterns = this.getSpendingPatterns(expenses, categories);
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const averageExpense = totalSpent / expenses.length;

    return {
      totalCategories: patterns.length,
      averageSpendingPerCategory: totalSpent / patterns.length,
      mostExpensiveCategory: patterns[0]?.category,
      leastExpensiveCategory: patterns[patterns.length - 1]?.category,
      averageExpenseAmount: averageExpense,
      spendingConsistency: this.calculateSpendingConsistency(expenses),
      categoryDiversity: patterns.length,
      topSpendingDay: this.findTopSpendingDay(expenses)
    };
  }

  private calculateSpendingConsistency(expenses: Expense[]): number {
    if (expenses.length < 2) return 0.5;

    const amounts = expenses.map(e => e.amount);
    const mean = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
    const standardDeviation = Math.sqrt(variance);
    
    return Math.max(0, 1 - (standardDeviation / mean));
  }

  private findTopSpendingDay(expenses: Expense[]): string {
    const dayTotals: { [key: string]: number } = {};
    
    expenses.forEach(expense => {
      const day = new Date(expense.date).getDate();
      dayTotals[day] = (dayTotals[day] || 0) + expense.amount;
    });
    
    const topDay = Object.entries(dayTotals)
      .sort(([,a], [,b]) => b - a)[0];
    
    return topDay ? `${topDay[0]}th` : 'N/A';
  }
} 