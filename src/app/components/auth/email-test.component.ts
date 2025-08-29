import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-email-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="email-test-container">
      <div class="email-test-card">
        <h2>Email Test & Debug</h2>
        
        <div class="debug-info">
          <h3>Firebase Configuration</h3>
          <p><strong>Project ID:</strong> expense-tracker-4d264</p>
          <p><strong>Auth Domain:</strong> expense-tracker-4d264.firebaseapp.com</p>
          <p><strong>Current User:</strong> {{ getCurrentUserInfo() }}</p>
        </div>

        <div class="test-form">
          <h3>Test Password Reset</h3>
          <div class="form-group">
            <label>Email Address:</label>
            <input 
              type="email" 
              [(ngModel)]="testEmail" 
              placeholder="Enter email to test"
              class="form-control">
          </div>
          
          <button 
            (click)="testPasswordReset()" 
            [disabled]="testing"
            class="btn-test">
            {{ testing ? 'Testing...' : 'Test Password Reset' }}
          </button>
        </div>

        <div class="results" *ngIf="testResults.length > 0">
          <h3>Test Results</h3>
          <div class="result-item" *ngFor="let result of testResults">
            <div class="result-time">{{ result.time }}</div>
            <div class="result-status" [class]="result.success ? 'success' : 'error'">
              {{ result.success ? '✅ Success' : '❌ Error' }}
            </div>
            <div class="result-message">{{ result.message }}</div>
          </div>
        </div>

        <div class="troubleshooting">
          <h3>Common Issues & Solutions</h3>
          <ul>
            <li><strong>No account found:</strong> Email doesn't exist in Firebase Auth</li>
            <li><strong>Network error:</strong> Check internet connection</li>
            <li><strong>Too many requests:</strong> Wait 5-10 minutes before retrying</li>
            <li><strong>Operation not allowed:</strong> Password reset disabled in Firebase</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .email-test-container {
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }

    .email-test-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    .debug-info {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    .debug-info h3 {
      margin-top: 0;
      color: #333;
    }

    .debug-info p {
      margin: 0.5rem 0;
      font-family: monospace;
    }

    .test-form {
      margin-bottom: 1.5rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }

    .form-control {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 1rem;
    }

    .btn-test {
      background: #007bff;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
    }

    .btn-test:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .results {
      margin-top: 1.5rem;
    }

    .result-item {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 0.5rem;
      border-left: 4px solid #007bff;
    }

    .result-time {
      font-size: 0.8rem;
      color: #666;
      margin-bottom: 0.5rem;
    }

    .result-status {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .result-status.success {
      color: #28a745;
    }

    .result-status.error {
      color: #dc3545;
    }

    .result-message {
      font-family: monospace;
      font-size: 0.9rem;
      white-space: pre-wrap;
    }

    .troubleshooting {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid #eee;
    }

    .troubleshooting ul {
      list-style: none;
      padding: 0;
    }

    .troubleshooting li {
      margin-bottom: 0.5rem;
      padding: 0.5rem;
      background: #fff3cd;
      border-radius: 4px;
      border-left: 4px solid #ffc107;
    }
  `]
})
export class EmailTestComponent {
  testEmail: string = '';
  testing: boolean = false;
  testResults: Array<{
    time: string;
    success: boolean;
    message: string;
  }> = [];

  constructor(private authService: AuthService) {}

  getCurrentUserInfo(): string {
    const user = this.authService.getCurrentUser();
    return user ? `${user.email} (${user.uid})` : 'No user logged in';
  }

  async testPasswordReset() {
    if (!this.testEmail) {
      this.addResult(false, 'Please enter an email address');
      return;
    }

    this.testing = true;
    
    try {
      console.log('Testing password reset for:', this.testEmail);
      await this.authService.sendPasswordResetEmail(this.testEmail);
      this.addResult(true, `Password reset email sent successfully to ${this.testEmail}`);
    } catch (error: any) {
      console.error('Test failed:', error);
      this.addResult(false, `Error: ${error.message}`);
    } finally {
      this.testing = false;
    }
  }

  private addResult(success: boolean, message: string) {
    this.testResults.unshift({
      time: new Date().toLocaleTimeString(),
      success,
      message
    });
  }
}
