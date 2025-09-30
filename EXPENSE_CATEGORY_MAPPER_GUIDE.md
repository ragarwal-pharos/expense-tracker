# 🔧 Expense Category Mapper - Complete Guide

## 🎯 **What This Tool Does**

The Expense Category Mapper allows you to **automatically link orphaned expenses to proper categories** based on your analysis. Instead of manually editing each expense, you can:

1. **Identify orphaned expenses** by category ID
2. **Map them to correct categories** in bulk
3. **Apply changes automatically** with validation
4. **Track results** and handle errors

## 🚀 **How to Use**

### **Step 1: Access the Mapper**
Navigate to `/mapper` in your expense tracker or use the direct link:
```
http://localhost:4200/mapper
```

### **Step 2: Review Orphaned Expenses**
The tool will show you:
- **Total orphaned expenses** and amounts
- **Grouped by category ID** (empty, deleted, invalid)
- **Expense details** for each group
- **Quick action buttons** to start mapping

### **Step 3: Create Category Mappings**
For each orphaned category group:
1. **Click "Map to Category"** button
2. **Select target category** from dropdown
3. **Add description** (optional)
4. **Repeat for other groups**

### **Step 4: Apply Mappings**
1. **Click "Validate Mappings"** to check for errors
2. **Click "Apply Mappings"** to execute changes
3. **Review results** and handle any errors

## 📊 **Example Usage Scenario**

### **Scenario: You have orphaned expenses like this:**

```
🚨 ORPHANED EXPENSES DETECTED
📊 Total orphaned expenses: 8
💰 Total orphaned amount: ₹15,500

📌 Category ID: "" (5 expenses, ₹8,500)
  1. Lunch at restaurant - ₹2,500 (2024-01-15)
  2. Pizza delivery - ₹1,200 (2024-01-16)
  3. Coffee shop - ₹800 (2024-01-17)
  4. Dinner with friends - ₹3,000 (2024-01-18)
  5. Fast food - ₹1,000 (2024-01-19)

📌 Category ID: "deleted_category_123" (3 expenses, ₹7,000)
  1. Uber ride - ₹2,000 (2024-01-20)
  2. Metro ticket - ₹500 (2024-01-21)
  3. Taxi fare - ₹4,500 (2024-01-22)
```

### **Your Analysis:**
- **Empty category expenses** → Should go to **Food & Dining**
- **Deleted category expenses** → Should go to **Transportation**

### **Mapping Process:**
1. **Map empty categories** to "Food & Dining"
2. **Map deleted categories** to "Transportation"
3. **Apply mappings** to update all expenses

## 🔧 **Detailed Steps**

### **Step 1: Review Orphaned Expenses Summary**
```
📊 Orphaned Expenses Summary
┌─────────────────────────────────────────────────────────┐
│ Empty Category ID                   5 expenses ₹8,500  │
│ [Map to Category] button                              │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Category ID: "deleted_category_123" 3 expenses ₹7,000  │
│ [Map to Category] button                              │
└─────────────────────────────────────────────────────────┘
```

### **Step 2: Create Mappings**
```
🔗 Category Mappings
┌─────────────────────────────────────────────────────────┐
│ Mapping 1                                    [Remove]   │
│ From: Empty Category ID                                 │
│ To: [🍕 Food & Dining ▼]                              │
│ Description: Map empty categories to Food & Dining     │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Mapping 2                                    [Remove]   │
│ From: Category ID: "deleted_category_123"              │
│ To: [🚙 Transportation ▼]                             │
│ Description: Map deleted categories to Transportation  │
└─────────────────────────────────────────────────────────┘
```

### **Step 3: Apply Mappings**
```
⚡ Action Buttons
[✅ Validate Mappings] [🚀 Apply Mappings]
```

### **Step 4: Review Results**
```
📊 Mapping Results
✅ Successfully Updated: 8 expenses
❌ Failed Updates: 0 expenses
```

## 🛠️ **Advanced Features**

### **Bulk Mapping**
You can create multiple mappings at once:
- **Map all empty categories** to one target category
- **Map different orphaned IDs** to different categories
- **Add descriptions** for tracking purposes

### **Validation**
Before applying mappings, the tool validates:
- **Target categories exist** in your system
- **Orphaned expenses exist** for each mapping
- **No duplicate mappings** for the same orphaned category

### **Error Handling**
If mappings fail, you'll see:
- **Detailed error messages** for each failure
- **Success/failure counts** for tracking
- **Updated expenses list** for verification

## 📋 **Common Mapping Scenarios**

### **Scenario 1: Empty Category IDs**
```
Orphaned: "" (empty string)
Target: Food & Dining
Description: Map empty categories to Food & Dining
```

### **Scenario 2: Deleted Categories**
```
Orphaned: "deleted_category_456"
Target: Transportation
Description: Map deleted categories to Transportation
```

### **Scenario 3: Invalid Category IDs**
```
Orphaned: "invalid_id_789"
Target: Other
Description: Map invalid categories to Other
```

## 🎯 **Best Practices**

### **Before Mapping:**
1. **Review orphaned expenses** carefully
2. **Identify the correct target categories**
3. **Add descriptive comments** for tracking
4. **Validate mappings** before applying

### **During Mapping:**
1. **Start with small batches** if you have many orphaned expenses
2. **Use descriptive names** for target categories
3. **Test with a few expenses** first if unsure

### **After Mapping:**
1. **Verify results** in the expenses page
2. **Check analysis page** for clean data
3. **Update any remaining orphaned expenses** manually

## 🔍 **Troubleshooting**

### **Common Issues:**

#### **"Target category not found"**
- **Solution:** Check that the target category exists in your categories list
- **Prevention:** Use the dropdown to select categories

#### **"No orphaned expenses found"**
- **Solution:** Refresh the data to reload orphaned expenses
- **Prevention:** Check that you have orphaned expenses first

#### **"Mapping failed"**
- **Solution:** Check network connection and try again
- **Prevention:** Validate mappings before applying

### **Error Recovery:**
1. **Check the error messages** for specific issues
2. **Fix the problems** (e.g., select valid categories)
3. **Re-apply the mappings** after fixes
4. **Contact support** if issues persist

## 📊 **Expected Results**

### **Before Mapping:**
- **Orphaned expenses** show as "Unknown Category"
- **Analysis page** shows warning banners
- **Data integrity** issues in reports

### **After Mapping:**
- **All expenses** have valid categories
- **Clean analysis** without warnings
- **Accurate reports** and statistics
- **Better data quality** overall

## 🚀 **Quick Start Checklist**

- [ ] **Navigate to `/mapper`**
- [ ] **Review orphaned expenses summary**
- [ ] **Click "Map to Category" for each group**
- [ ] **Select appropriate target categories**
- [ ] **Add descriptions (optional)**
- [ ] **Click "Validate Mappings"**
- [ ] **Click "Apply Mappings"**
- [ ] **Review results and verify changes**
- [ ] **Check expenses page for updated categories**

The Expense Category Mapper makes it easy to fix orphaned expenses in bulk, saving you time and ensuring data integrity!
