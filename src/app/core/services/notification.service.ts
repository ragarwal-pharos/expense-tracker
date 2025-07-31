import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  icon?: string;
  duration?: number;
  action?: {
    label: string;
    callback: () => void;
  };
  autoClose?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notifications.asObservable();

  success(title: string, message: string, icon: string = '✅', duration: number = 5000) {
    this.addNotification({
      id: this.generateId(),
      type: 'success',
      title,
      message,
      icon,
      duration,
      autoClose: true
    });
  }

  error(title: string, message: string, icon: string = '❌', duration: number = 8000) {
    this.addNotification({
      id: this.generateId(),
      type: 'error',
      title,
      message,
      icon,
      duration,
      autoClose: true
    });
  }

  warning(title: string, message: string, icon: string = '⚠️', duration: number = 6000) {
    this.addNotification({
      id: this.generateId(),
      type: 'warning',
      title,
      message,
      icon,
      duration,
      autoClose: true
    });
  }

  info(title: string, message: string, icon: string = 'ℹ️', duration: number = 4000) {
    this.addNotification({
      id: this.generateId(),
      type: 'info',
      title,
      message,
      icon,
      duration,
      autoClose: true
    });
  }

  achievement(title: string, message: string, icon: string = '🎉') {
    this.addNotification({
      id: this.generateId(),
      type: 'success',
      title,
      message,
      icon,
      duration: 10000,
      autoClose: true
    });
  }

  addNotification(notification: Notification) {
    const currentNotifications = this.notifications.value;
    this.notifications.next([...currentNotifications, notification]);

    if (notification.autoClose && notification.duration) {
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.duration);
    }
  }

  removeNotification(id: string) {
    const currentNotifications = this.notifications.value;
    this.notifications.next(currentNotifications.filter(n => n.id !== id));
  }

  clearAll() {
    this.notifications.next([]);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // User-friendly error messages
  handleError(error: any, context: string = '') {
    let title = 'Error';
    let message = 'Something went wrong. Please try again.';

    if (error?.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    if (context) {
      title = `${context} Error`;
    }

    this.error(title, message);
  }

  // Success messages for common actions
  expenseAdded(amount: number) {
    this.success(
      'Expense Added! 💸',
      `Successfully added ₹${amount.toLocaleString()} to your expenses.`,
      '✅'
    );
  }

  expenseUpdated(amount: number) {
    this.success(
      'Expense Updated! ✏️',
      `Successfully updated expense to ₹${amount.toLocaleString()}.`,
      '✅'
    );
  }

  expenseDeleted() {
    this.success(
      'Expense Deleted! 🗑️',
      'Expense has been removed from your records.',
      '✅'
    );
  }

  categoryAdded(name: string) {
    this.success(
      'Category Created! 🏷️',
      `New category "${name}" has been added successfully.`,
      '✅'
    );
  }

  categoryUpdated(name: string) {
    this.success(
      'Category Updated! ✏️',
      `Category "${name}" has been updated successfully.`,
      '✅'
    );
  }

  categoryDeleted(name: string) {
    this.success(
      'Category Deleted! 🗑️',
      `Category "${name}" has been removed successfully.`,
      '✅'
    );
  }

  budgetSet(amount: number) {
    this.success(
      'Budget Set! 💰',
      `Monthly budget has been set to ₹${amount.toLocaleString()}.`,
      '✅'
    );
  }

  goalUpdated(name: string) {
    this.success(
      'Goal Updated! 🎯',
      `Financial goal "${name}" has been updated successfully.`,
      '✅'
    );
  }

  // Achievement notifications
  streakAchievement(days: number) {
    this.achievement(
      'Streak Achievement! 🔥',
      `Amazing! You've logged expenses for ${days} consecutive days!`,
      '🔥'
    );
  }

  budgetGoalAchieved() {
    this.achievement(
      'Budget Goal Achieved! 🎉',
      'Congratulations! You stayed within your budget this month!',
      '🎉'
    );
  }

  savingsMilestone(amount: number) {
    this.achievement(
      'Savings Milestone! 💎',
      `Fantastic! You've saved ₹${amount.toLocaleString()} so far!`,
      '💎'
    );
  }

  categoryMastery(categoryName: string) {
    this.achievement(
      'Category Master! 🏆',
      `You've become a master at tracking ${categoryName} expenses!`,
      '🏆'
    );
  }
} 