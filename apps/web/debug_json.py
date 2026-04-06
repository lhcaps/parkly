import json

# Read the file
with open('c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'r', encoding='utf-8') as f:
    content = f.read()

# Find what is at byte position 69268
print(f"Total bytes: {len(content)}")
snippet = content[69260:69290]
print(f"Bytes 69260-69290: {repr(snippet)}")

# Also try to find where root object closes
lines = content.split('\n')
print(f"Total lines: {len(lines)}")
print(f"Line 1783 (idx 1782): {repr(lines[1782])}")
print(f"Line 1784 (idx 1783): {repr(lines[1783])}")
print(f"Line 1785 (idx 1784): {repr(lines[1784])}")
print(f"Line 1786 (idx 1785): {repr(lines[1785])}")
print(f"Line 1787 (idx 1786): {repr(lines[1786])}")
