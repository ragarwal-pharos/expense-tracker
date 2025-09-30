import { Injectable } from '@angular/core';
import { Chart, registerables } from 'chart.js';

@Injectable({
  providedIn: 'root'
})
export class ChartConfigService {
  
  constructor() {
    this.initializeChart();
  }

  private initializeChart() {
    // Register all Chart.js components
    Chart.register(...registerables);
    
    // Set default configuration
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    
    // Configure default colors
    Chart.defaults.color = '#64748b';
    Chart.defaults.borderColor = '#e1e8ed';
    Chart.defaults.backgroundColor = 'rgba(102, 126, 234, 0.1)';
  }
}
