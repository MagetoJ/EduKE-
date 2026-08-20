path = "models_roles.py"
with open(path, encoding="utf-8") as f:
    lines = f.readlines()

marker = "from database import Base\n"
addition = "from datetime import datetime\n"

if addition in lines:
    print("✅ 'from datetime import datetime' is already present. No changes made.")
else:
    for i, line in enumerate(lines):
        if line == marker:
            lines.insert(i + 1, addition)
            with open(path, "w", encoding="utf-8") as f:
                f.writelines(lines)
            print(f"✅ Inserted 'from datetime import datetime' after line {i+1}.")
            break
    else:
        print("⚠️ Could not find 'from database import Base' to anchor the insert. "
              "No changes made — please add 'from datetime import datetime' manually near the top of the file.")