import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ScrollService {

  constructor() { }

  /**
   * Scrolls to the top of the page with smooth animation
   */
  scrollToTop() {
    // Smooth scroll to top of window
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
    
    // Also scroll the main content container if it exists
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      });
    }
  }

  /**
   * Scrolls to a specific element with smooth animation
   */
  scrollToElement(elementId: string) {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
    }
  }

  /**
   * Scrolls to a specific position with smooth animation
   */
  scrollToPosition(top: number, left: number = 0) {
    window.scrollTo({
      top: top,
      left: left,
      behavior: 'smooth'
    });
  }

  /**
   * Gets the current scroll position
   */
  getScrollPosition(): { top: number, left: number } {
    return {
      top: window.pageYOffset || document.documentElement.scrollTop,
      left: window.pageXOffset || document.documentElement.scrollLeft
    };
  }
} 