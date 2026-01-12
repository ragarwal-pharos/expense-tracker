import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseCategoryMapperService, CategoryMapping } from '../../core/services/expense-category-mapper.service';
import { FirebaseService } from '../../core/services/firebase.service';
import { Category } from '../../core/models/category.model';
import { Expense } from '../../core/models/expense.model';
import { Subscription, combineLatest } from 'rxjs';

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
  styleUrls: ['./expense-category-mapper.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpenseCategoryMapperComponent implements OnInit, OnDestroy {
  orphanedCategories: OrphanedCategorySummary[] = [];
  availableCategories: Category[] = [];
  mappings: CategoryMapping[] = [];
  isLoading = true;
  isMapping = false;
  mappingResults: any = null;
  private subscription: Subscription = new Subscription();

  constructor(
    private mapperService: ExpenseCategoryMapperService,
    private firebaseService: FirebaseService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Subscribe to Firebase observables for real-time updates
    this.subscription.add(
      combineLatest([
        this.firebaseService.expenses$,
        this.firebaseService.categories$
      ]).subscribe(([expenses, categories]) => {
        // Reload orphaned expenses summary when data changes
        this.loadData();
        this.cdr.markForCheck(); // Trigger change detection for OnPush
      })
    );

    // Subscribe to loading state
    this.subscription.add(
      this.firebaseService.loading$.subscribe(loading => {
        this.isLoading = loading;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  async loadData() {
    try {
      const summary = await this.mapperService.getOrphanedExpensesSummary();
      this.orphanedCategories = summary.byCategoryId;
      this.availableCategories = await this.mapperService.getAvailableCategories();
      
      console.log('📊 Orphaned expenses summary:', summary);
      console.log('🏷️ Available categories:', this.availableCategories);
      
      this.isLoading = false;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading data:', error);
      this.isLoading = false;
      this.cdr.markForCheck();
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
