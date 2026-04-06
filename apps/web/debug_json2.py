import json

# Read the file
with open('c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
print(f"Total lines: {len(lines)}")

# Find where accounts starts and ends
for i, line in enumerate(lines):
    if 'accounts' in line.lower() and i < 10:
        print(f"Line {i+1}: {repr(line[:60])}")
    if '"dialog"' in line:
        print(f"Line {i+1}: {repr(line[:60])}")
    if i >= 1853:
        print(f"Line {i+1}: {repr(line[:80])}")
