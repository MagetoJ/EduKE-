path = "models_roles.py"
with open(path, encoding="utf-8") as f:
    lines = f.readlines()

marker = "from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint, Enum as SQLEnum\n"
new_import_line = "from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint, Enum as SQLEnum, Boolean\n"

if marker not in lines:
    print("⚠️ Expected import line not found exactly as-is — no changes made.")
    print("   Please manually add ', Boolean' to your sqlalchemy import line.")
else:
    idx = lines.index(marker)
    lines[idx] = new_import_line
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print(f"✅ Updated line {idx+1} to import Boolean.")