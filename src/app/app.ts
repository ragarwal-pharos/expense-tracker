import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ScrollService } from './core/services/scroll.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.html',
  styles: [`
    /* App Container */
    .app-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      position: relative;
      overflow-x: hidden;
    }

    /* Ensure html and body don't interfere */
    html, body {
      overflow-x: hidden;
      position: relative;
      height: 100%;
      margin: 0;
      padding: 0;
    }

    /* Use dynamic viewport height for mobile */
    @supports (height: 100dvh) {
      .sidebar,
      .sidebar-overlay {
        height: 100dvh;
        min-height: 100dvh;
        max-height: 100dvh;
      }
    }

    /* Force full height on mobile browsers */
    @media (max-width: 768px) {
      .sidebar,
      .sidebar-overlay {
        height: 100vh !important;
        min-height: 100vh !important;
        max-height: 100vh !important;
        top: 0 !important;
      }
    }

    /* Header */
    .app-header {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 0;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .sidebar-toggle {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 8px;
      padding: 0.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      min-width: 44px;
      min-height: 44px;
    }

    .sidebar-toggle:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }

    /* Hide sidebar toggle on desktop when nav is visible */
    @media (min-width: 769px) {
      .sidebar-toggle {
        display: none;
      }
    }

    .hamburger-icon {
      font-size: 1.2rem;
      color: white;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .brand-icon {
      font-size: 1.5rem;
    }

    .brand-text {
      font-size: 1.2rem;
      font-weight: 600;
      color: white;
    }

    .header-nav {
      display: flex;
      gap: 1rem;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.3s ease;
      font-weight: 500;
    }

    .nav-link:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
    }

    .nav-link.active {
      background: rgba(255, 255, 255, 0.3);
    }

    .nav-icon {
      font-size: 1rem;
    }

    .nav-text {
      font-size: 0.9rem;
    }

    /* Sidebar */
    .sidebar-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      min-height: 100vh;
      max-height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      z-index: 200;
      backdrop-filter: blur(4px);
      padding-top: env(safe-area-inset-top);
      box-sizing: border-box;
    }

    .sidebar {
      position: fixed;
      top: 0;
      left: -300px;
      width: 300px;
      height: 100vh;
      min-height: 100vh;
      max-height: 100vh;
      background: linear-gradient(135deg, #ff8c42 0%, #ffa726 50%, #ffcc02 100%);
      box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
      z-index: 300;
      transition: left 0.3s ease;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding-top: env(safe-area-inset-top);
      box-sizing: border-box;
    }

    .sidebar.sidebar-open {
      left: 0;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      flex-shrink: 0;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .sidebar-nav {
      padding: 1rem 0;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .sidebar-link {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      color: white;
      text-decoration: none;
      transition: all 0.3s ease;
      border-left: 3px solid transparent;
    }

    .sidebar-link:hover {
      background: rgba(255, 255, 255, 0.1);
      border-left-color: rgba(255, 255, 255, 0.5);
    }

    .sidebar-link.active {
      background: rgba(255, 255, 255, 0.2);
      border-left-color: white;
    }

    .link-icon {
      font-size: 1.2rem;
      width: 24px;
      text-align: center;
    }

    .link-text {
      font-size: 1rem;
      font-weight: 500;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      background: #f8f9fa;
      transition: filter 0.3s ease;
    }

    .main-content.content-blurred {
      filter: blur(4px);
      pointer-events: none;
    }

    .content-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .header-content {
        padding: 1rem;
      }

      .header-nav {
        display: none;
      }

      .sidebar-toggle {
        display: flex;
      }

      .sidebar {
        width: 280px;
        left: -280px;
        height: 100vh;
        min-height: 100vh;
        max-height: 100vh;
        top: 0;
      }

      .sidebar-overlay {
        height: 100vh;
        min-height: 100vh;
        max-height: 100vh;
        top: 0;
      }

      .content-container {
        padding: 1rem;
      }

      .brand-text {
        font-size: 1.1rem;
      }
    }

    @media (max-width: 480px) {
      .header-content {
        padding: 0.75rem;
      }

      .sidebar {
        width: 260px;
        left: -260px;
        height: 100vh;
        min-height: 100vh;
        max-height: 100vh;
        top: 0;
      }

      .sidebar-overlay {
        height: 100vh;
        min-height: 100vh;
        max-height: 100vh;
        top: 0;
      }

      .content-container {
        padding: 0.75rem;
      }
    }
  `]
})
export class App {
  sidebarOpen = false;

  constructor(private scrollService: ScrollService) {}

  toggleSidebar() {
    console.log('Toggle sidebar called');
    this.sidebarOpen = !this.sidebarOpen;
    
    if (this.sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeSidebar() {
    console.log('Close sidebar called');
    this.sidebarOpen = false;
    document.body.style.overflow = '';
  }

  onNavClick() {
    this.closeSidebar();
    this.scrollService.scrollToTop();
  }
}
