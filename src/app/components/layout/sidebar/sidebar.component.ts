import { Component, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { ScrollService } from '../../../core/services/scroll.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  @Output() close = new EventEmitter<void>();
  
  constructor(
    public themeService: ThemeService,
    private scrollService: ScrollService
  ) {}

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  onNavClick() {
    // Close the sidebar
    this.close.emit();
    
    // Scroll to top of the page
    this.scrollService.scrollToTop();
  }
} 