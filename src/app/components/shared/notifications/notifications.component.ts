import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../../../core/services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notifications-container">
      <div 
        *ngFor="let notification of notifications; trackBy: trackByNotification"
        class="notification-item"
        [class]="'notification-' + notification.type"
        (click)="removeNotification(notification.id)">
        
        <div class="notification-content">
          <div class="notification-icon">{{ notification.icon }}</div>
          <div class="notification-text">
            <div class="notification-title">{{ notification.title }}</div>
            <div class="notification-message">{{ notification.message }}</div>
          </div>
          <button 
            class="notification-close"
            (click)="removeNotification(notification.id, $event)">
            ✕
          </button>
        </div>
        
        <div class="notification-action" *ngIf="notification.action">
          <button 
            class="action-button"
            (click)="executeAction(notification.action!.callback, $event)">
            {{ notification.action.label }}
          </button>
        </div>
        
        <div class="notification-progress" *ngIf="notification.duration">
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="getProgress(notification)"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscription: Subscription = new Subscription();

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    this.subscription.add(
      this.notificationService.notifications$.subscribe(notifications => {
        this.notifications = notifications;
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  removeNotification(id: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.notificationService.removeNotification(id);
  }

  executeAction(callback: () => void, event: Event) {
    event.stopPropagation();
    callback();
  }

  trackByNotification(index: number, notification: Notification): string {
    return notification.id;
  }

  getProgress(notification: Notification): number {
    if (!notification.duration) return 100;
    
    // Calculate progress based on time elapsed
    const elapsed = Date.now() - parseInt(notification.id);
    const progress = Math.max(0, 100 - (elapsed / notification.duration) * 100);
    return Math.min(100, Math.max(0, progress));
  }
} 