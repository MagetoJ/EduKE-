path = "auth.py"
with open(path, encoding="utf-8") as f:
    lines = f.readlines()

target = '       if not school or (getattr(school, "status", "active") or "").strip().lower() != \'active\':\n'
fixed = '    if not school or (getattr(school, "status", "active") or "").strip().lower() != \'active\':\n'

if lines[131] == target:
    lines[131] = fixed
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("✅ Fixed indentation on line 132.")
else:
    print("⚠️ Line 132 didn't match the expected broken text exactly — no changes made.")
    print(f"Actual line 132: {repr(lines[131])}")