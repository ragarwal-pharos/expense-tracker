import { Injectable } from '@angular/core';
import { ExpenseService } from './expense.service';
import { CategoryService } from './category.service';
import { Expense } from '../models/expense.model';
import { Category } from '../models/category.model';

export interface CategoryMapping {
  orphanedCategoryId: string;
  targetCategoryId: string;
  targetCategoryName: string;
  description?: string;
}

export interface BulkMappingResult {
  success: number;
  failed: number;
  errors: string[];
  updatedExpenses: Expense[];
}

@Injectable({
  providedIn: 'root'
})
export class ExpenseCategoryMapperService {

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService
  ) {}

  /**
   * Map orphaned expenses to proper categories based on your analysis
   * @param mappings Array of category mappings
   * @returns Promise with bulk mapping results
   */
  async mapOrphanedExpenses(mappings: CategoryMapping[]): Promise<BulkMappingResult> {
    const result: BulkMappingResult = {
      success: 0,
      failed: 0,
      errors: [],
      updatedExpenses: []
    };

    try {
      console.log('🔄 Starting bulk category mapping...');
      console.log(`📋 Processing ${mappings.length} category mappings`);

      // Get all expenses and categories
      const expenses = await this.expenseService.getAll();
      const categories = await this.categoryService.getAll();

      // Process each mapping
      for (const mapping of mappings) {
        try {
          console.log(`\n📌 Processing mapping: "${mapping.orphanedCategoryId}" → "${mapping.targetCategoryName}"`);
          
          // Find target category
          const targetCategory = categories.find(c => c.id === mapping.targetCategoryId);
          if (!targetCategory) {
            const error = `Target category not found: ${mapping.targetCategoryName} (ID: ${mapping.targetCategoryId})`;
            console.error(`❌ ${error}`);
            result.errors.push(error);
            result.failed++;
            continue;
          }

          // Find orphaned expenses for this category ID
          const orphanedExpenses = expenses.filter(expense => 
            expense.categoryId === mapping.orphanedCategoryId
          );

          console.log(`🔍 Found ${orphanedExpenses.length} orphaned expenses for category ID: "${mapping.orphanedCategoryId}"`);

          if (orphanedExpenses.length === 0) {
            console.log(`⚠️ No orphaned expenses found for category ID: "${mapping.orphanedCategoryId}"`);
            continue;
          }

          // Update each orphaned expense
          for (const expense of orphanedExpenses) {
            try {
              const updatedExpense: Expense = {
                ...expense,
                categoryId: mapping.targetCategoryId
              };

              await this.expenseService.update(updatedExpense);
              result.updatedExpenses.push(updatedExpense);
              result.success++;

              console.log(`✅ Updated expense: "${expense.description || 'No description'}" (₹${expense.amount}) → ${mapping.targetCategoryName}`);
            } catch (error) {
              const errorMsg = `Failed to update expense ${expense.id}: ${error}`;
              console.error(`❌ ${errorMsg}`);
              result.errors.push(errorMsg);
              result.failed++;
            }
          }

        } catch (error) {
          const errorMsg = `Failed to process mapping for ${mapping.orphanedCategoryId}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          result.errors.push(errorMsg);
          result.failed++;
        }
      }

      console.log(`\n🎉 Bulk mapping completed!`);
      console.log(`✅ Successfully updated: ${result.success} expenses`);
      console.log(`❌ Failed updates: ${result.failed} expenses`);
      console.log(`📊 Total errors: ${result.errors.length}`);

      return result;

    } catch (error) {
      const errorMsg = `Bulk mapping failed: ${error}`;
      console.error(`❌ ${errorMsg}`);
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Get orphaned expenses grouped by category ID
   */
  async getOrphanedExpensesByCategory(): Promise<Map<string, Expense[]>> {
    const expenses = await this.expenseService.getAll();
    const categories = await this.categoryService.getAll();
    
    const orphanedExpenses = expenses.filter(expense => 
      !categories.find(c => c.id === expense.categoryId)
    );

    const groupedByCategoryId = new Map<string, Expense[]>();
    orphanedExpenses.forEach(expense => {
      if (!groupedByCategoryId.has(expense.categoryId)) {
        groupedByCategoryId.set(expense.categoryId, []);
      }
      groupedByCategoryId.get(expense.categoryId)!.push(expense);
    });

    return groupedByCategoryId;
  }

  /**
   * Get available categories for mapping
   */
  async getAvailableCategories(): Promise<Category[]> {
    return await this.categoryService.getAll();
  }

  /**
   * Validate mapping before applying
   */
  async validateMappings(mappings: CategoryMapping[]): Promise<{valid: boolean, errors: string[]}> {
    const errors: string[] = [];
    const categories = await this.categoryService.getAll();
    const orphanedByCategory = await this.getOrphanedExpensesByCategory();

    for (const mapping of mappings) {
      // Check if target category exists
      const targetCategory = categories.find(c => c.id === mapping.targetCategoryId);
      if (!targetCategory) {
        errors.push(`Target category not found: ${mapping.targetCategoryName} (ID: ${mapping.targetCategoryId})`);
      }

      // Check if orphaned category has expenses
      const orphanedExpenses = orphanedByCategory.get(mapping.orphanedCategoryId);
      if (!orphanedExpenses || orphanedExpenses.length === 0) {
        errors.push(`No orphaned expenses found for category ID: ${mapping.orphanedCategoryId}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create mapping from orphaned category ID to target category
   */
  createMapping(
    orphanedCategoryId: string, 
    targetCategoryId: string, 
    targetCategoryName: string,
    description?: string
  ): CategoryMapping {
    return {
      orphanedCategoryId,
      targetCategoryId,
      targetCategoryName,
      description
    };
  }

  /**
   * Get summary of orphaned expenses for easy analysis
   */
  async getOrphanedExpensesSummary(): Promise<{
    totalOrphaned: number;
    totalAmount: number;
    byCategoryId: Array<{
      categoryId: string;
      count: number;
      amount: number;
      expenses: Expense[];
    }>;
  }> {
    const orphanedByCategory = await this.getOrphanedExpensesByCategory();
    
    const byCategoryId = Array.from(orphanedByCategory.entries()).map(([categoryId, expenses]) => ({
      categoryId,
      count: expenses.length,
      amount: expenses.reduce((sum, expense) => sum + expense.amount, 0),
      expenses
    }));

    const totalOrphaned = byCategoryId.reduce((sum, item) => sum + item.count, 0);
    const totalAmount = byCategoryId.reduce((sum, item) => sum + item.amount, 0);

    return {
      totalOrphaned,
      totalAmount,
      byCategoryId
    };
  }
}
