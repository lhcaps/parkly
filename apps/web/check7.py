
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')

# Check for BOM
if content.startswith('\ufeff'):
    print('File has BOM')
    content = content[1:]
else:
    print('No BOM')

# Try to parse
try:
    data = json.loads(content)
    print(f'JSON VALID! Top keys: {sorted(data.keys())}')
    print(f'accounts exists: {"accounts" in data}')
    print(f'accounts keys: {sorted(data.get("accounts", {}).keys())}')
except json.JSONDecodeError as e:
    print(f'JSON INVALID: {e}')
    print(f'pos: {e.pos}, lineno: {e.lineno}, colno: {e.colno}')
    
    # Count braces to understand nesting
    lines = content.split('\n')
    brace_count = 0
    for i, l in enumerate(lines[:e.lineno+2]):
        for ch in l:
            if ch == '{':
                brace_count += 1
            elif ch == '}':
                brace_count -= 1
        print(f'  L{i+1} ({brace_count}): {repr(l[:60])}')
    
    print(f'\nBrace balance at error line: {brace_count}')
