import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseCategoryMapperService, CategoryMapping } from '../../core/services/expense-category-mapper.service';
import { Category } from '../../core/models/category.model';
import { Expense } from '../../core/models/expense.model';

interface OrphanedCategorySummary {
  categoryId: string;
  count: number;
  amount: number;
  expenses: Expense[];
}

@Component({
  selector: 'app-expense-category-mapper',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expense-category-mapper.component.html',
  styleUrls: ['./expense-category-mapper.component.scss']
})
export class ExpenseCategoryMapperComponent implements OnInit {
  orphanedCategories: OrphanedCategorySummary[] = [];
  availableCategories: Category[] = [];
  mappings: CategoryMapping[] = [];
  isLoading = true;
  isMapping = false;
  mappingResults: any = null;

  constructor(
    private mapperService: ExpenseCategoryMapperService
  ) {}

  async ngOnInit() {
    await this.loadData();
    this.isLoading = false;
  }

  async loadData() {
    try {
      const summary = await this.mapperService.getOrphanedExpensesSummary();
      this.orphanedCategories = summary.byCategoryId;
      this.availableCategories = await this.mapperService.getAvailableCategories();
      
      console.log('📊 Orphaned expenses summary:', summary);
      console.log('🏷️ Available categories:', this.availableCategories);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  addMapping(orphanedCategoryId: string) {
    const mapping: CategoryMapping = {
      orphanedCategoryId,
      targetCategoryId: '',
      targetCategoryName: '',
      description: ''
    };
    this.mappings.push(mapping);
  }

  removeMapping(index: number) {
    this.mappings.splice(index, 1);
  }

  onTargetCategoryChange(mapping: CategoryMapping, targetCategoryId: string) {
    const category = this.availableCategories.find(c => c.id === targetCategoryId);
    if (category) {
      mapping.targetCategoryId = targetCategoryId;
      mapping.targetCategoryName = category.name;
    }
  }

  async validateMappings() {
    try {
      const validation = await this.mapperService.validateMappings(this.mappings);
      if (validation.valid) {
        console.log('✅ All mappings are valid');
        return true;
      } else {
        console.error('❌ Validation errors:', validation.errors);
        return false;
      }
    } catch (error) {
      console.error('❌ Validation failed:', error);
      return false;
    }
  }

  async applyMappings() {
    if (this.mappings.length === 0) {
      console.log('⚠️ No mappings to apply');
      return;
    }

    this.isMapping = true;
    try {
      console.log('🔄 Applying category mappings...');
      const result = await this.mapperService.mapOrphanedExpenses(this.mappings);
      
      this.mappingResults = result;
      console.log('🎉 Mapping completed:', result);
      
      // Reload data to reflect changes
      await this.loadData();
      
      // Clear mappings after successful application
      this.mappings = [];
      
    } catch (error) {
      console.error('❌ Mapping failed:', error);
    } finally {
      this.isMapping = false;
    }
  }

  getOrphanedCategoryDisplay(categoryId: string): string {
    if (categoryId === '') {
      return 'Empty Category ID';
    }
    return `Category ID: "${categoryId}"`;
  }

  getOrphanedCategoryDescription(categoryId: string): string {
    if (categoryId === '') {
      return 'Expenses with no category selected (empty categoryId)';
    }
    return `Expenses referencing deleted or invalid category ID: "${categoryId}"`;
  }

  // Get expenses for a specific orphaned category ID
  getExpensesForMapping(categoryId: string): Expense[] {
    const orphanedCategory = this.orphanedCategories.find(cat => cat.categoryId === categoryId);
    return orphanedCategory ? orphanedCategory.expenses : [];
  }
}
