import { Injectable } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { Expense } from '../models/expense.model';
import { Category } from '../models/category.model';

// Register all Chart.js components
Chart.register(...registerables);

export interface ChartData {
  labels: string[];
  datasets: any[];
}

export interface TrendData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    tension: number;
  }[];
}

export interface PieData {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
    borderWidth: number;
  }[];
}

export interface BarData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  
  private readonly colorPalette = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c',
    '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
    '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3',
    '#d299c2', '#fef9d7', '#667eea', '#764ba2'
  ];

  constructor() {
    // Ensure Chart.js components are registered
    this.ensureChartRegistration();
  }

  private ensureChartRegistration() {
    // This method ensures all required Chart.js components are registered
    if (!Chart.registry.getScale('category')) {
      Chart.register(...registerables);
    }
  }

  // Generate trend line data for spending over time
  generateTrendData(expenses: Expense[], months: number = 12): TrendData {
    // Start from July 2025
    const startDate = new Date(2025, 6, 1); // July 2025 (month is 0-indexed)
    const labels: string[] = [];
    const data: number[] = [];

    for (let i = 0; i < months; i++) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      labels.push(monthLabel);

      const monthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === date.getMonth() && 
               expenseDate.getFullYear() === date.getFullYear();
      });

      const totalAmount = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      data.push(totalAmount);
    }

    return {
      labels,
      datasets: [{
        label: 'Monthly Spending',
        data,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4
      }]
    };
  }

  // Generate pie chart data for category breakdown
  generatePieData(expenses: Expense[], categories: Category[]): PieData {
    const categoryTotals = new Map<string, number>();
    
    expenses.forEach(expense => {
      const current = categoryTotals.get(expense.categoryId) || 0;
      categoryTotals.set(expense.categoryId, current + expense.amount);
    });

    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColor: string[] = [];
    const borderColor: string[] = [];

    categoryTotals.forEach((amount, categoryId) => {
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        labels.push(category.name);
        data.push(amount);
        const colorIndex = labels.length - 1;
        backgroundColor.push(this.colorPalette[colorIndex % this.colorPalette.length]);
        borderColor.push('#ffffff');
      }
    });

    return {
      labels,
      datasets: [{
        data,
        backgroundColor,
        borderColor,
        borderWidth: 2
      }]
    };
  }

  // Generate bar chart data for monthly comparison
  generateBarData(expenses: Expense[], months: number = 6): BarData {
    // Start from July 2025
    const startDate = new Date(2025, 6, 1); // July 2025 (month is 0-indexed)
    const labels: string[] = [];
    const data: number[] = [];

    for (let i = 0; i < months; i++) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      labels.push(monthLabel);

      const monthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === date.getMonth() && 
               expenseDate.getFullYear() === date.getFullYear();
      });

      const totalAmount = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      data.push(totalAmount);
    }

    return {
      labels,
      datasets: [{
        label: 'Monthly Spending',
        data,
        backgroundColor: 'rgba(102, 126, 234, 0.8)',
        borderColor: '#667eea',
        borderWidth: 1
      }]
    };
  }

  // Generate sparkline data for a specific category
  generateSparklineData(expenses: Expense[], categoryId: string, days: number = 30): number[] {
    // Start from July 1, 2025
    const startDate = new Date(2025, 6, 1); // July 1, 2025 (month is 0-indexed)
    const data: number[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
      const dateString = date.toISOString().split('T')[0];

      const dayExpenses = expenses.filter(expense => 
        expense.categoryId === categoryId && 
        expense.date === dateString
      );

      const totalAmount = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      data.push(totalAmount);
    }

    return data;
  }

  // Get chart options for different chart types
  getTrendOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Month'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Amount ($)'
          },
          beginAtZero: true
        }
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false
      }
    };
  }

  getPieOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right' as const,
          labels: {
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: $${value.toFixed(2)} (${percentage}%)`;
            }
          }
        }
      }
    };
  }

  getBarOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Month'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Amount ($)'
          },
          beginAtZero: true
        }
      }
    };
  }

  getSparklineOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false
        }
      },
      elements: {
        point: {
          radius: 0
        }
      }
    };
  }
}
