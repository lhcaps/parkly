
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')

print(f'Total chars: {len(content)}')
print(f'Last 30 chars: {repr(content[-30:])}')

lines = content.split('\n')
print(f'Total lines from split: {len(lines)}')

print(f'\nLines 1848-1860:')
for i in range(1848, min(1860, len(lines))):
    print(f'  L{i+1}: {repr(lines[i])}')

print(f'\nJSON validity:')
try:
    data = json.loads(content)
    print(f'  VALID')
    print(f'  accounts keys: {list(data.get("accounts", {}).keys())}')
    print(f'  Top keys: {sorted(data.keys())}')
except json.JSONDecodeError as e:
    print(f'  INVALID: {e}')
    print(f'  Error pos: {e.pos}, lineno: {e.lineno}, colno: {e.colno}')
    # Walk from start
    pos = 0
    line_num = 1
    col_num = 1
    for i, ch in enumerate(content):
        if i == e.pos:
            line_num_actual = content[:i].count('\n') + 1
            col_num_actual = i - content.rfind('\n', 0, i) 
            print(f'  Computed error pos: line {line_num_actual}, col {col_num_actual}')
            print(f'  Around: {repr(content[max(0,i-50):i+50])}')
            break
