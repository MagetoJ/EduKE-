import pandas as pd
import numpy as np
import os

# Create the directory if it doesn't exist
output_dir = "simulation_and_moddelling"
os.makedirs(output_dir, exist_ok=True)
file_path = os.path.join(output_dir, "Simulation_Assignment.xlsx")

# 1. Define the datasets from the assignment
dataset1 = [55, 60, 62, 65, 67, 68, 70, 72, 73, 75, 76, 78, 80, 82, 83, 85, 87, 88, 90, 92]
dataset2 = [5, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 12, 13, 15, 18, 22, 28, 35, 50, 75]
dataset3 = [12, 13, 13, 14, 14, 15, 15, 15, 16, 16, 16, 17, 17, 18, 18, 19, 20, 25, 40, 65]

# 2. Create DataFrames
df_main = pd.DataFrame({
    'Scores (Dataset 1)': dataset1,
    'Time (Dataset 2)': dataset2,
    'Traffic (Dataset 3)': dataset3
})

# Question 8 Dataset (Dataset 2 + Extreme Values)
extreme_values = [10, 150, 200]
dataset2_extreme = dataset2 + extreme_values
df_extreme = pd.DataFrame({
    'Time with Extreme Values (Q8)': dataset2_extreme
})

# Function to write frequency data for a column chart (manual histogram)
def write_histogram_data(ws, data, start_row, start_col, name):
    counts, bins = np.histogram(data, bins=5)
    ws.write(start_row, start_col, f"Bins ({name})")
    ws.write(start_row, start_col + 1, "Frequency")
    for idx, (count, bin_val) in enumerate(zip(counts, bins)):
        ws.write(start_row + 1 + idx, start_col, f"{bin_val:.1f}")
        ws.write(start_row + 1 + idx, start_col + 1, int(count))
    return len(counts)

# 3. Write to Excel with XlsxWriter engine
with pd.ExcelWriter(file_path, engine='xlsxwriter') as writer:
    # --- Main Analysis Sheet ---
    df_main.to_excel(writer, sheet_name='Analysis', index=False)
    
    workbook  = writer.book
    worksheet = writer.sheets['Analysis']
    
    # Statistical Formulas for Analysis
    metrics = ['Mean', 'Std Dev', 'Skewness', 'Kurtosis']
    formulas = ['AVERAGE', 'STDEV.S', 'SKEW', 'KURT']
    
    for i, col in enumerate(['A', 'B', 'C']):
        for j, (metric, func) in enumerate(zip(metrics, formulas)):
            row_num = 23 + j
            if i == 0: # Add labels
                worksheet.write(f'E{row_num + 1}', metric)
            
            worksheet.write_formula(f'{col}{row_num + 1}', f'={func}({col}2:{col}21)')
            
    # Manual Histograms using Column Charts
    for i, (col_name, data) in enumerate(df_main.items()):
        start_row = 30 + (i * 10)
        num_bins = write_histogram_data(worksheet, data, start_row, 0, col_name)
        
        chart = workbook.add_chart({'type': 'column'})
        chart.add_series({
            'name':       f'Freq: {col_name}',
            'categories': ['Analysis', start_row + 1, 0, start_row + num_bins, 0],
            'values':     ['Analysis', start_row + 1, 1, start_row + num_bins, 1],
        })
        chart.set_title({'name': f'Histogram: {col_name}'})
        worksheet.insert_chart(f'G{2 + (i * 15)}', chart)

    # --- Question 8 Sheet ---
    df_extreme.to_excel(writer, sheet_name='Question 8', index=False)
    ws_q8 = writer.sheets['Question 8']
    
    # Statistical Formulas for Q8
    for j, (metric, func) in enumerate(zip(metrics, formulas)):
        row_num = 26 + j
        ws_q8.write(f'C{row_num + 1}', metric)
        ws_q8.write_formula(f'A{row_num + 1}', f'={func}(A2:A24)')
        
    # Histogram for Q8
    num_bins_q8 = write_histogram_data(ws_q8, dataset2_extreme, 35, 0, "Extreme")
    chart_q8 = workbook.add_chart({'type': 'column'})
    chart_q8.add_series({
        'name':       'Freq: Time with Extreme Values',
        'categories': ['Question 8', 36, 0, 36 + num_bins_q8 - 1, 0],
        'values':     ['Question 8', 36, 1, 36 + num_bins_q8 - 1, 1],
    })
    chart_q8.set_title({'name': 'Histogram: Time with Extreme Values (Q8)'})
    ws_q8.insert_chart('E2', chart_q8)

print(f"Excel file '{file_path}' has been created successfully!")
