with open('auth.py', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(120, 138):
    print(f"{i+1}: {repr(lines[i])}")