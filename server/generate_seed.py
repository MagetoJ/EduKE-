import pandas as pd
import math

def sanitize_column_name(col):
    """Sanitizes Excel headers to match typical DB column conventions."""
    col = str(col).strip().lower()
    col = col.replace(" ", "_").replace("/", "_").replace("-", "_")
    col = col.replace("(", "").replace(")", "")
    # Clean up double underscores if any
    while "__" in col:
        col = col.replace("__", "_")
    return col

def sanitize_value(val):
    """Formats values safely for SQL insertion."""
    if pd.isna(val):
        return "NULL"
    elif isinstance(val, str):
        # Escape single quotes in SQL by doubling them
        escaped_val = val.replace("'", "''").strip()
        return f"'{escaped_val}'"
    elif isinstance(val, (int, float)):
        # Handle trailing .0 in floats that are meant to be integers (like phone numbers)
        if math.isinf(val):
            return "NULL"
        return str(val)
    else:
        return f"'{str(val)}'"

def generate_sql_script(excel_file, output_sql_file):
    try:
        xls = pd.ExcelFile(excel_file)
        
        # Mapping Excel sheets to target database tables
        sheet_table_mapping = {
            'Comprehensive_Students': 'students',
            'Comprehensive_Teachers': 'teachers',
            'Comprehensive_Support_Staff': 'support_staff'
        }
        
        with open(output_sql_file, 'w', encoding='utf-8') as f:
            f.write(f"-- Auto-generated SQL Seeding Script for {excel_file}\n")
            f.write("BEGIN;\n\n") # Start transaction
            
            for sheet_name in xls.sheet_names:
                if sheet_name not in sheet_table_mapping:
                    continue
                
                table_name = sheet_table_mapping[sheet_name]
                f.write(f"-- Populating table: {table_name}\n")
                
                df = pd.read_excel(xls, sheet_name=sheet_name)
                
                for index, row in df.iterrows():
                    cols = []
                    vals = []
                    
                    for col, val in row.items():
                        clean_col = sanitize_column_name(col)
                        cols.append(f'"{clean_col}"')
                        vals.append(sanitize_value(val))
                    
                    columns_str = ", ".join(cols)
                    values_str = ", ".join(vals)
                    
                    sql = f"INSERT INTO {table_name} ({columns_str}) VALUES ({values_str});\n"
                    f.write(sql)
                
                f.write("\n")
                
            f.write("COMMIT;\n") # End transaction
            print(f"Success! SQL script generated at: {output_sql_file}")
            
    except Exception as e:
        print(f"An error occurred: {e}")

# Run the generation
if __name__ == "__main__":
    EXCEL_FILE = "Comprehensive_Kenyan_CBE_Day_School_Data.xlsx"
    OUTPUT_FILE = "populate_schools_data.sql"
    
    generate_sql_script(EXCEL_FILE, OUTPUT_FILE)