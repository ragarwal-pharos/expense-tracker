import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseService } from '../../core/services/expense.service';
import { CategoryService } from '../../core/services/category.service';
import { Expense } from '../../core/models/expense.model';
import { Category } from '../../core/models/category.model';
import { LoadingService } from '../../core/services/loading.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-monthly-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monthly-reports.component.html',
  styleUrls: ['./monthly-reports.component.scss']
})
export class MonthlyReportsComponent implements OnInit {
  expenses: Expense[] = [];
  categories: Category[] = [];
  monthlyReports: any[] = [];
  selectedMonth: string = '';
  showDetailedView: boolean = false;

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private loadingService: LoadingService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loadingService.show('Loading reports...');
    
    try {
      this.expenses = await this.expenseService.getAll();
      this.categories = await this.categoryService.getAll();
      
      // Generate monthly reports after loading data
      this.generateMonthlyReports();
      
      this.notificationService.success(
        'Reports Loaded! 📊',
        `Found ${this.expenses.length} expenses for analysis.`,
        '✅'
      );
    } catch (error) {
      this.notificationService.handleError(error, 'Reports');
    } finally {
      this.loadingService.hide();
    }
  }

  generateMonthlyReports() {
    const monthlyExpenses: { [key: string]: Expense[] } = {};
    
    this.expenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyExpenses[monthKey]) {
        monthlyExpenses[monthKey] = [];
      }
      monthlyExpenses[monthKey].push(expense);
    });
    
    this.monthlyReports = [];
    Object.keys(monthlyExpenses).sort().reverse().forEach(monthKey => {
      const expenses = monthlyExpenses[monthKey];
      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const categoryBreakdown = this.getCategoryBreakdown(expenses);
      
      const [year, month] = monthKey.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      this.monthlyReports.push({
        monthKey,
        monthName,
        totalAmount,
        expenseCount: expenses.length,
        categoryBreakdown,
        expenses
      });
    });
  }

  getCategoryBreakdown(expenses: Expense[]): any[] {
    const breakdown: { [key: string]: { amount: number, count: number, category: Category } } = {};
    
    expenses.forEach(expense => {
      const category = this.categories.find(cat => cat.id === expense.categoryId);
      if (category) {
        if (!breakdown[category.id]) {
          breakdown[category.id] = { amount: 0, count: 0, category };
        }
        breakdown[category.id].amount += expense.amount;
        breakdown[category.id].count += 1;
      }
    });
    
    return Object.values(breakdown).sort((a, b) => b.amount - a.amount);
  }

  getCurrentMonthReport() {
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    return this.monthlyReports.find(report => report.monthKey === currentMonthKey);
  }

  getPreviousMonthReport() {
    const currentDate = new Date();
    const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
    const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
    return this.monthlyReports.find(report => report.monthKey === previousMonthKey);
  }

  getMonthlyComparison() {
    const currentReport = this.getCurrentMonthReport();
    const previousReport = this.getPreviousMonthReport();
    
    if (!currentReport || !previousReport) {
      return { change: 0, percentage: 0, hasPreviousData: false };
    }
    
    const change = currentReport.totalAmount - previousReport.totalAmount;
    const hasPreviousData = previousReport.totalAmount > 0;
    const percentage = hasPreviousData ? (change / previousReport.totalAmount) * 100 : 0;
    
    return { change, percentage, hasPreviousData };
  }

  selectMonth(monthKey: string) {
    this.selectedMonth = monthKey;
    this.showDetailedView = true;
  }

  getSelectedMonthReport() {
    return this.monthlyReports.find(report => report.monthKey === this.selectedMonth);
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown';
  }

  getCategoryIcon(categoryId: string): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category?.icon || '📌';
  }

  getCategoryColor(categoryId: string): string {
    const category = this.categories.find(cat => cat.id === categoryId);
    return category?.color || '#999';
  }
} 