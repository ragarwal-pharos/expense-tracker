import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { LoadingService } from '../../core/services/loading.service';
import { NotificationService } from '../../core/services/notification.service';
import { InsightsService, SpendingPattern, SavingsOpportunity } from '../../core/services/insights.service';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  expenses: Expense[] = [];
  categories: Category[] = [];
  totalSpent = 0;
  categoryTotals: { [key: string]: number } = {};
  monthlyTotal = 0;
  weeklyTotal = 0;

  // Filter properties
  selectedFilter: 'all' | 'monthly' | 'yearly' | 'custom' = 'all';
  customStartDate: string = '';
  customEndDate: string = '';

  // Budget properties
  budgetLimit: number = 0;
  budgetProgress: number = 0;
  spendingTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  topSpendingDay: string = '';
  averageDailySpending: number = 0;
  projectedMonthlySpending: number = 0;
  financialHealthScore: number = 0;

  // Alerts and insights
  alerts: any[] = [];
  overspendingCategories: any[] = [];
  unusualSpending: any[] = [];

  // Financial goals
  financialGoals: any[] = [];
  goalProgress: { [key: string]: number } = {};

  // New insights properties
  spendingPatterns: SpendingPattern[] = [];
  savingsOpportunities: SavingsOpportunity[] = [];
  financialHealthInsights: any = {};

  private subscription: Subscription = new Subscription();

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private loadingService: LoadingService,
    private notificationService: NotificationService,
    private insightsService: InsightsService
  ) {}

  ngOnInit() {
    this.loadData();
    this.loadFinancialGoals();
    this.loadBudgetData();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  async loadData() {
    this.loadingService.show('Loading your financial data...');
    
    try {
      const [expenses, categories] = await Promise.all([
        Promise.resolve(this.expenseService.getAll()),
        Promise.resolve(this.categoryService.getAll())
      ]);

      this.expenses = expenses || [];
      this.categories = categories || [];
      
      this.calculateTotals();
      this.analyzeFinancialHealth();
      this.generateInsights();
      this.generateAdvancedInsights();
      this.checkAlerts();
      
      this.notificationService.success(
        'Dashboard Loaded! 📊',
        'Your financial overview is ready with personalized insights.',
        '✅'
      );
    } catch (error) {
      this.notificationService.handleError(error, 'Dashboard');
    } finally {
      this.loadingService.hide();
    }
  }

  calculateTotals() {
    const filteredExpenses = this.getFilteredExpenses();
    
    this.totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    this.monthlyTotal = this.getCurrentMonthExpenses().reduce((sum, e) => sum + e.amount, 0);
    this.weeklyTotal = this.getCurrentWeekExpenses().reduce((sum, e) => sum + e.amount, 0);

    // Calculate category totals
    this.categoryTotals = {};
    filteredExpenses.forEach(expense => {
      this.categoryTotals[expense.categoryId] = (this.categoryTotals[expense.categoryId] || 0) + expense.amount;
    });

    // Recalculate budget progress
    if (this.budgetLimit > 0) {
      this.budgetProgress = (this.monthlyTotal / this.budgetLimit) * 100;
    }
  }

  getFilteredExpenses(): Expense[] {
    switch (this.selectedFilter) {
      case 'monthly':
        return this.getCurrentMonthExpenses();
      case 'yearly':
        return this.getCurrentYearExpenses();
      case 'custom':
        return this.getCustomDateRangeExpenses();
      default:
        return this.expenses;
    }
  }

  getCurrentYearExpenses(): Expense[] {
    const currentYear = new Date().getFullYear();
    return this.expenses.filter(e => new Date(e.date).getFullYear() === currentYear);
  }

  getCustomDateRangeExpenses(): Expense[] {
    if (!this.customStartDate || !this.customEndDate) {
      return this.expenses;
    }
    
    const startDate = new Date(this.customStartDate);
    const endDate = new Date(this.customEndDate);
    
    return this.expenses.filter(e => {
      const expenseDate = new Date(e.date);
      return expenseDate >= startDate && expenseDate <= endDate;
    });
  }

  onFilterChange() {
    this.calculateTotals();
    this.generateAdvancedInsights();
  }

  getFilterLabel(): string {
    switch (this.selectedFilter) {
      case 'monthly':
        return 'Current Month';
      case 'yearly':
        return 'Current Year';
      case 'custom':
        return `Custom Range (${this.customStartDate} to ${this.customEndDate})`;
      default:
        return 'All Time';
    }
  }

  getFilteredTotal(): number {
    return this.getFilteredExpenses().reduce((sum, e) => sum + e.amount, 0);
  }

  analyzeFinancialHealth() {
    const currentMonthExpenses = this.getCurrentMonthExpenses();
    const previousMonthExpenses = this.getPreviousMonthExpenses();
    
    // Calculate spending trend
    const currentTotal = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const previousTotal = previousMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    if (currentTotal > previousTotal * 1.1) {
      this.spendingTrend = 'increasing';
    } else if (currentTotal < previousTotal * 0.9) {
      this.spendingTrend = 'decreasing';
    } else {
      this.spendingTrend = 'stable';
    }

    // Calculate average daily spending
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    this.averageDailySpending = currentTotal / daysInMonth;

    // Project monthly spending
    const daysElapsed = new Date().getDate();
    this.projectedMonthlySpending = (currentTotal / daysElapsed) * daysInMonth;

    // Calculate financial health score
    const categoryDiversity = this.categories.length;
    const spendingConsistency = this.calculateSpendingConsistency();
    const budgetAdherence = this.calculateBudgetAdherence();
    
    this.financialHealthScore = Math.min(100, 
      (categoryDiversity * 10) + 
      (spendingConsistency * 30) + 
      (budgetAdherence * 60)
    );

    // Find top spending day
    this.findTopSpendingDay();
  }

  generateAdvancedInsights() {
    const filteredExpenses = this.getFilteredExpenses();
    
    // Generate spending patterns
    this.spendingPatterns = this.insightsService.getSpendingPatterns(filteredExpenses, this.categories);
    
    // Generate savings opportunities
    this.savingsOpportunities = this.insightsService.getSavingsOpportunities(filteredExpenses, this.categories);
    
    // Generate financial health insights
    this.financialHealthInsights = this.insightsService.getFinancialHealthInsights(filteredExpenses, this.categories);
  }

  generateInsights() {
    this.alerts = [];
    this.overspendingCategories = [];
    this.unusualSpending = [];

    const currentMonthExpenses = this.getCurrentMonthExpenses();
    const categoryAverages = this.calculateCategoryAverages();

    // Check for overspending categories
    this.categories.forEach(category => {
      const categoryTotal = currentMonthExpenses
        .filter(e => e.categoryId === category.id)
        .reduce((sum, e) => sum + e.amount, 0);
      
      const average = categoryAverages[category.id] || 0;
      if (categoryTotal > average * 1.5) {
        this.overspendingCategories.push({
          category,
          current: categoryTotal,
          average,
          percentage: ((categoryTotal - average) / average * 100).toFixed(1)
        });
        
        this.alerts.push({
          type: 'warning',
          message: `You're spending ${((categoryTotal - average) / average * 100).toFixed(1)}% more on ${category.name} than usual`,
          icon: '⚠️'
        });
      }
    });

    // Check for unusual spending patterns
    const recentExpenses = currentMonthExpenses.slice(-5);
    const averageExpense = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0) / currentMonthExpenses.length;
    
    recentExpenses.forEach(expense => {
      if (expense.amount > averageExpense * 2) {
        this.unusualSpending.push(expense);
        this.alerts.push({
          type: 'info',
          message: `Unusual high expense: ₹${expense.amount} on ${this.getCategoryName(expense.categoryId)}`,
          icon: '💡'
        });
      }
    });

    // Budget alerts
    if (this.budgetLimit > 0 && this.monthlyTotal > this.budgetLimit * 0.8) {
      this.alerts.push({
        type: 'danger',
        message: `You've used ${((this.monthlyTotal / this.budgetLimit) * 100).toFixed(1)}% of your monthly budget`,
        icon: '🚨'
      });
    }
  }

  checkAlerts() {
    const currentMonthExpenses = this.getCurrentMonthExpenses();
    
    // Check for daily spending patterns
    const today = new Date();
    const todayExpenses = currentMonthExpenses.filter(e => 
      new Date(e.date).toDateString() === today.toDateString()
    );
    
    if (todayExpenses.length > 3) {
      this.alerts.push({
        type: 'info',
        message: `You've made ${todayExpenses.length} expenses today. Consider consolidating purchases.`,
        icon: '📝'
      });
    }

    // Check for weekend vs weekday spending
    const weekendExpenses = currentMonthExpenses.filter(e => {
      const day = new Date(e.date).getDay();
      return day === 0 || day === 6;
    });
    
    const weekdayExpenses = currentMonthExpenses.filter(e => {
      const day = new Date(e.date).getDay();
      return day !== 0 && day !== 6;
    });
    
    const weekendTotal = weekendExpenses.reduce((sum, e) => sum + e.amount, 0);
    const weekdayTotal = weekdayExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    if (weekendTotal > weekdayTotal * 1.5) {
      this.alerts.push({
        type: 'warning',
        message: 'You spend significantly more on weekends. Consider planning your weekend activities.',
        icon: '📅'
      });
    }
  }

  loadFinancialGoals() {
    const savedGoals = localStorage.getItem('financialGoals');
    if (savedGoals) {
      this.financialGoals = JSON.parse(savedGoals);
    } else {
      this.financialGoals = [
        {
          id: 'emergency',
          name: 'Emergency Fund',
          target: 50000,
          current: 0,
          type: 'savings'
        },
        {
          id: 'vacation',
          name: 'Vacation Fund',
          target: 100000,
          current: 0,
          type: 'savings'
        },
        {
          id: 'monthly',
          name: 'Monthly Budget',
          target: 30000,
          current: this.monthlyTotal,
          type: 'budget'
        }
      ];
      localStorage.setItem('financialGoals', JSON.stringify(this.financialGoals));
    }
    this.calculateGoalProgress();
  }

  calculateGoalProgress() {
    this.goalProgress = {};
    this.financialGoals.forEach(goal => {
      this.goalProgress[goal.id] = Math.min(100, (goal.current / goal.target) * 100);
    });
  }

  calculateSpendingConsistency(): number {
    const currentMonthExpenses = this.getCurrentMonthExpenses();
    if (currentMonthExpenses.length < 2) return 0.5;

    const amounts = currentMonthExpenses.map(e => e.amount);
    const mean = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
    const standardDeviation = Math.sqrt(variance);
    
    return Math.max(0, 1 - (standardDeviation / mean));
  }

  calculateBudgetAdherence(): number {
    if (this.budgetLimit === 0) return 0.5;
    const adherence = 1 - (this.monthlyTotal / this.budgetLimit);
    return Math.max(0, Math.min(1, adherence));
  }

  calculateCategoryAverages(): { [key: string]: number } {
    const monthlyExpenses = this.getMonthlyExpenses();
    const averages: { [key: string]: number } = {};
    
    this.categories.forEach(category => {
      const categoryExpenses = Object.values(monthlyExpenses)
        .flat()
        .filter(e => e.categoryId === category.id);
      
      if (categoryExpenses.length > 0) {
        averages[category.id] = categoryExpenses.reduce((sum, e) => sum + e.amount, 0) / categoryExpenses.length;
      }
    });
    
    return averages;
  }

  findTopSpendingDay() {
    const currentMonthExpenses = this.getCurrentMonthExpenses();
    const dayTotals: { [key: string]: number } = {};
    
    currentMonthExpenses.forEach(expense => {
      const day = new Date(expense.date).getDate();
      dayTotals[day] = (dayTotals[day] || 0) + expense.amount;
    });
    
    const topDay = Object.entries(dayTotals)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topDay) {
      this.topSpendingDay = `${topDay[0]}th`;
    }
  }

  getMonthlyExpenses(): { [key: string]: Expense[] } {
    const monthlyExpenses: { [key: string]: Expense[] } = {};
    
    this.expenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyExpenses[monthKey]) {
        monthlyExpenses[monthKey] = [];
      }
      monthlyExpenses[monthKey].push(expense);
    });
    
    return monthlyExpenses;
  }

  getCurrentMonthExpenses(): Expense[] {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    return this.expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
    });
  }

  getCurrentWeekExpenses(): Expense[] {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    return this.expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= startOfWeek;
    });
  }

  getPreviousMonthExpenses(): Expense[] {
    const currentDate = new Date();
    const previousMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
    const previousYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();
    
    return this.expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === previousMonth && expenseDate.getFullYear() === previousYear;
    });
  }

  getPreviousMonthTotal(): number {
    return this.getPreviousMonthExpenses().reduce((sum, e) => sum + e.amount, 0);
  }

  getMonthlyComparison(): { change: number, percentage: number, hasPreviousData: boolean } {
    const currentTotal = this.getCurrentMonthExpenses().reduce((sum, e) => sum + e.amount, 0);
    const previousTotal = this.getPreviousMonthTotal();
    
    if (previousTotal === 0) {
      return { change: 0, percentage: 0, hasPreviousData: false };
    }
    
    const change = currentTotal - previousTotal;
    const percentage = (change / previousTotal) * 100;
    
    return { change, percentage, hasPreviousData: true };
  }

  getTopSpendingCategories(): any[] {
    const currentMonthExpenses = this.getCurrentMonthExpenses();
    const categoryTotals: { [key: string]: number } = {};
    
    currentMonthExpenses.forEach(expense => {
      categoryTotals[expense.categoryId] = (categoryTotals[expense.categoryId] || 0) + expense.amount;
    });
    
    return Object.entries(categoryTotals)
      .map(([categoryId, amount]) => ({
        category: this.categories.find(c => c.id === categoryId),
        amount
      }))
      .filter(item => item.category)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  getCategoryName(id: string): string {
    const category = this.categories.find(c => c.id === id);
    return category?.name || 'Unknown';
  }

  getCategoryColor(id: string): string {
    const category = this.categories.find(c => c.id === id);
    return category?.color || '#999';
  }

  getCategoryIcon(id: string): string {
    const category = this.categories.find(c => c.id === id);
    return category?.icon || '📌';
  }

  getExpensesByCategory(categoryId: string): Expense[] {
    return this.getFilteredExpenses().filter(e => e.categoryId === categoryId);
  }

  loadBudgetData() {
    const savedBudget = localStorage.getItem('monthlyBudget');
    if (savedBudget) {
      const budgetAmount = parseFloat(savedBudget);
      if (!isNaN(budgetAmount) && budgetAmount > 0) {
        this.budgetLimit = budgetAmount;
        this.syncBudgetWithFinancialGoals(budgetAmount);
      } else {
        this.clearBudget();
      }
    }
  }

  syncBudgetWithFinancialGoals(budgetAmount: number) {
    const savedGoals = localStorage.getItem('financialGoals');
    if (savedGoals) {
      const goals = JSON.parse(savedGoals);
      const monthlyGoal = goals.find((goal: any) => goal.id === 'monthly');
      if (monthlyGoal && monthlyGoal.target !== budgetAmount) {
        monthlyGoal.target = budgetAmount;
        monthlyGoal.current = this.monthlyTotal;
        localStorage.setItem('financialGoals', JSON.stringify(goals));
      }
    }
  }

  setBudgetWithPrompt() {
    const currentBudget = this.budgetLimit > 0 ? this.budgetLimit.toString() : '';
    const newBudget = window.prompt('Enter your monthly budget amount (₹):', currentBudget);
    
    if (newBudget !== null && newBudget.trim() !== '') {
      const amount = parseFloat(newBudget);
      if (!isNaN(amount) && amount >= 0) {
        this.setBudgetLimit(amount);
      } else {
        this.notificationService.error('Invalid Amount', 'Please enter a valid number greater than or equal to 0.');
      }
    }
  }

  setBudgetLimit(amount: number) {
    this.budgetLimit = amount;
    localStorage.setItem('monthlyBudget', amount.toString());
    this.updateFinancialGoalsBudget(amount);
    this.calculateTotals();
    this.notificationService.budgetSet(amount);
  }

  updateFinancialGoalsBudget(newBudget: number) {
    const monthlyBudgetGoal = this.financialGoals.find(goal => goal.id === 'monthly');
    if (monthlyBudgetGoal) {
      monthlyBudgetGoal.target = newBudget;
      monthlyBudgetGoal.current = this.monthlyTotal;
    } else {
      this.financialGoals.push({
        id: 'monthly',
        name: 'Monthly Budget',
        target: newBudget,
        current: this.monthlyTotal,
        type: 'budget'
      });
    }
    localStorage.setItem('financialGoals', JSON.stringify(this.financialGoals));
    this.calculateGoalProgress();
  }

  updateEmergencyFundWithPrompt() {
    const emergencyGoal = this.financialGoals.find(goal => goal.id === 'emergency');
    const currentTarget = emergencyGoal ? emergencyGoal.target.toString() : '';
    const newTarget = window.prompt('Enter your Emergency Fund target amount (₹):', currentTarget);
    if (newTarget !== null && newTarget.trim() !== '') {
      const amount = parseFloat(newTarget);
      if (!isNaN(amount) && amount >= 0) {
        this.updateFinancialGoal('emergency', amount);
      } else {
        this.notificationService.error('Invalid Amount', 'Please enter a valid amount greater than or equal to 0.');
      }
    }
  }

  updateVacationFundWithPrompt() {
    const vacationGoal = this.financialGoals.find(goal => goal.id === 'vacation');
    const currentTarget = vacationGoal ? vacationGoal.target.toString() : '';
    const newTarget = window.prompt('Enter your Vacation Fund target amount (₹):', currentTarget);
    if (newTarget !== null && newTarget.trim() !== '') {
      const amount = parseFloat(newTarget);
      if (!isNaN(amount) && amount >= 0) {
        this.updateFinancialGoal('vacation', amount);
      } else {
        this.notificationService.error('Invalid Amount', 'Please enter a valid amount greater than or equal to 0.');
      }
    }
  }

  updateFinancialGoal(goalId: string, newTarget: number) {
    const goal = this.financialGoals.find(g => g.id === goalId);
    if (goal) {
      goal.target = newTarget;
      localStorage.setItem('financialGoals', JSON.stringify(this.financialGoals));
      this.calculateGoalProgress();
      this.notificationService.goalUpdated(goal.name);
    }
  }

  clearBudget() {
    this.budgetLimit = 0;
    this.budgetProgress = 0;
    localStorage.removeItem('monthlyBudget');
    
    // Clear monthly budget from financial goals
    const monthlyGoal = this.financialGoals.find(goal => goal.id === 'monthly');
    if (monthlyGoal) {
      monthlyGoal.target = 0;
      localStorage.setItem('financialGoals', JSON.stringify(this.financialGoals));
      this.calculateGoalProgress();
    }
  }

  getBudgetStatus(): string {
    if (this.budgetLimit === 0) return 'not-set';
    if (this.budgetProgress >= 100) return 'exceeded';
    if (this.budgetProgress >= 80) return 'warning';
    return 'good';
  }

  getBudgetStatusText(): string {
    const status = this.getBudgetStatus();
    switch (status) {
      case 'not-set': return 'Not Set';
      case 'exceeded': return 'Exceeded';
      case 'warning': return 'Warning';
      case 'good': return 'Good';
      default: return 'Unknown';
    }
  }

  getBudgetStatusColor(): string {
    const status = this.getBudgetStatus();
    switch (status) {
      case 'not-set': return '#6c757d';
      case 'exceeded': return '#dc3545';
      case 'warning': return '#ffc107';
      case 'good': return '#28a745';
      default: return '#6c757d';
    }
  }

  getBudgetRemaining(): number {
    return this.budgetLimit - this.monthlyTotal;
  }

  getBudgetPercentage(): number {
    if (this.budgetLimit === 0) return 0;
    const percentage = (this.monthlyTotal / this.budgetLimit) * 100;
    return Math.min(100, Math.max(0, percentage));
  }
} 