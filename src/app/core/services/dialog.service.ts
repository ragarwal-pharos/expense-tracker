import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface DialogConfig {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  inputType?: 'text' | 'number' | 'date' | 'email' | 'password' | 'color';
  inputValue?: string;
  inputPlaceholder?: string;
  inputLabel?: string;
  options?: Array<{value: string, label: string, icon?: string}>;
  selectedValue?: string;
  // For multi-field forms
  fields?: Array<{
    name: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'email' | 'password' | 'color';
    value: string;
    placeholder?: string;
    required?: boolean;
  }>;
}

export interface DialogResult {
  confirmed: boolean;
  value?: string;
  selectedOption?: string;
  fieldValues?: { [key: string]: string };
}

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private dialogSubject = new BehaviorSubject<DialogConfig | null>(null);
  private resultSubject = new BehaviorSubject<DialogResult | null>(null);

  public dialog$ = this.dialogSubject.asObservable();
  public result$ = this.resultSubject.asObservable();

  // Simple alert dialog
  alert(message: string, title: string = 'Information'): Promise<void> {
    return new Promise((resolve) => {
      this.dialogSubject.next({
        title,
        message,
        type: 'info',
        confirmText: 'OK'
      });

      this.result$.subscribe(result => {
        if (result) {
          this.dialogSubject.next(null);
          this.resultSubject.next(null);
          resolve();
        }
      });
    });
  }

  // Success dialog
  success(message: string, title: string = 'Success'): Promise<void> {
    return new Promise((resolve) => {
      this.dialogSubject.next({
        title,
        message,
        type: 'success',
        confirmText: 'OK'
      });

      this.result$.subscribe(result => {
        if (result) {
          this.dialogSubject.next(null);
          this.resultSubject.next(null);
          resolve();
        }
      });
    });
  }

  // Warning dialog
  warning(message: string, title: string = 'Warning'): Promise<void> {
    return new Promise((resolve) => {
      this.dialogSubject.next({
        title,
        message,
        type: 'warning',
        confirmText: 'OK'
      });

      this.result$.subscribe(result => {
        if (result) {
          this.dialogSubject.next(null);
          this.resultSubject.next(null);
          resolve();
        }
      });
    });
  }

  // Error dialog
  error(message: string, title: string = 'Error'): Promise<void> {
    return new Promise((resolve) => {
      this.dialogSubject.next({
        title,
        message,
        type: 'error',
        confirmText: 'OK'
      });

      this.result$.subscribe(result => {
        if (result) {
          this.dialogSubject.next(null);
          this.resultSubject.next(null);
          resolve();
        }
      });
    });
  }

  // Confirmation dialog
  confirm(message: string, title: string = 'Confirm'): Promise<boolean> {
    return new Promise((resolve) => {
      this.dialogSubject.next({
        title,
        message,
        type: 'confirm',
        confirmText: 'Yes',
        cancelText: 'No'
      });

      this.result$.subscribe(result => {
        if (result) {
          this.dialogSubject.next(null);
          this.resultSubject.next(null);
          resolve(result.confirmed);
        }
      });
    });
  }

  // Prompt dialog for text input
  prompt(
    message: string, 
    title: string = 'Input Required',
    defaultValue: string = '',
    inputType: 'text' | 'number' | 'date' | 'email' | 'password' = 'text',
    placeholder: string = '',
    label: string = ''
  ): Promise<string | null> {
    return new Promise((resolve) => {
      this.dialogSubject.next({
        title,
        message,
        type: 'confirm',
        confirmText: 'OK',
        cancelText: 'Cancel',
        inputType,
        inputValue: defaultValue,
        inputPlaceholder: placeholder,
        inputLabel: label
      });

      this.result$.subscribe(result => {
        if (result) {
          this.dialogSubject.next(null);
          this.resultSubject.next(null);
          resolve(result.confirmed ? result.value || null : null);
        }
      });
    });
  }

  // Selection dialog for choosing from options
  select(
    message: string,
    title: string = 'Select Option',
    options: Array<{value: string, label: string, icon?: string}>,
    selectedValue?: string
  ): Promise<string | null> {
    return new Promise((resolve) => {
      this.dialogSubject.next({
        title,
        message,
        type: 'confirm',
        confirmText: 'OK',
        cancelText: 'Cancel',
        options,
        selectedValue
      });

      this.result$.subscribe(result => {
        if (result) {
          this.dialogSubject.next(null);
          this.resultSubject.next(null);
          resolve(result.confirmed ? result.selectedOption || null : null);
        }
      });
    });
  }

  // Multi-field form dialog
  form(fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'email' | 'password' | 'color';
    value: string;
    placeholder?: string;
    required?: boolean;
  }>, title: string = 'Edit', message: string = 'Please fill in the details:'): Promise<{ [key: string]: string } | null> {
    return new Promise((resolve) => {
      this.dialogSubject.next({
        title,
        message,
        type: 'confirm',
        fields,
        confirmText: 'Save',
        cancelText: 'Cancel'
      });

      this.result$.subscribe(result => {
        if (result) {
          this.dialogSubject.next(null);
          this.resultSubject.next(null);
          resolve(result.confirmed ? result.fieldValues || null : null);
        }
      });
    });
  }

  // Method to handle dialog result
  handleResult(result: DialogResult): void {
    this.resultSubject.next(result);
  }

  // Method to close dialog
  close(): void {
    this.dialogSubject.next(null);
    this.resultSubject.next(null);
  }
}
