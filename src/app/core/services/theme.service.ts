import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private themeKey = 'theme';
  private currentTheme: 'light' | 'dark' = 'light';

  constructor() {
    const saved = localStorage.getItem(this.themeKey);
    this.currentTheme = (saved as 'light' | 'dark') || 'light';
    this.applyTheme();
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem(this.themeKey, this.currentTheme);
    this.applyTheme();
  }

  getTheme() {
    return this.currentTheme;
  }

  private applyTheme() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
  }
} 