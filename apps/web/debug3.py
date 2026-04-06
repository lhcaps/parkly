
import json
from json import decoder

try:
    with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'r', encoding='utf-8') as f:
        content = f.read()
    data = json.loads(content)
    print('VALID JSON')
    print('accounts keys:', list(data.get('accounts', {}).keys()))
    print('Top-level keys:', sorted(data.keys()))
except json.JSONDecodeError as e:
    print(f'JSON Error: {e}')
    # Show context around the error
    err_line, err_col = e.lineno, e.colno
    lines = content.split('\n')
    print(f'Error at line {err_line}, col {err_col}')
    start = max(0, err_line - 5)
    end = min(len(lines), err_line + 3)
    for i in range(start, end):
        marker = '>>> ' if i + 1 == err_line else '    '
        print(f'{marker}L{i+1}: {repr(lines[i])}')
