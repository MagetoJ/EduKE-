path = "models_roles.py"
with open(path, encoding="utf-8") as f:
    lines = f.readlines()

marker = "from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint\n"
new_import_line = "from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint, Enum as SQLEnum\n"

if any("SQLEnum" in line and line.startswith("from sqlalchemy import") for line in lines):
    print("✅ SQLEnum import already present. No changes made.")
elif marker in lines:
    idx = lines.index(marker)
    lines[idx] = new_import_line
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print(f"✅ Updated line {idx+1} to import SQLEnum (as alias for sqlalchemy.Enum).")
else:
    print("⚠️ Could not find the expected sqlalchemy import line to modify.")
    print("   Please manually add ', Enum as SQLEnum' to your sqlalchemy import line, e.g.:")
    print("   from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint, Enum as SQLEnum")