
import json
import re

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')

print(f'Total chars: {len(content)}')

try:
    data = json.loads(content)
    print(f'JSON VALID! Top keys: {sorted(data.keys())}')
    print(f'accounts keys: {sorted(data.get("accounts", {}).keys())}')
except json.JSONDecodeError as e:
    print(f'JSON INVALID: {e}')
    print(f'Error lineno: {e.lineno}, colno: {e.colno}')
    
    # Find the ACTUAL line and column
    lines = content.split('\n')
    print(f'Total lines from split: {len(lines)}')
    
    # Compute error line manually
    before = content[:e.pos]
    lines_before = before.count('\n')
    cols_before = len(before) - before.rfind('\n') - 1
    print(f'Actual error: line {lines_before + 1}, col {cols_before + 1}')
    print(f'Around error: {repr(content[max(0,e.pos-50):e.pos+50])}')
    
    # Print surrounding lines
    print(f'\nSurrounding lines:')
    for i in range(max(0, lines_before - 3), min(len(lines), lines_before + 5)):
        marker = '>>> ' if i == lines_before else '    '
        print(f'{marker}L{i+1}: {repr(lines[i])}')
