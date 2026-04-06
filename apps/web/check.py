
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')
lines = content.split('\n')

print(f'Lines 1849-1860:')
for i in range(1848, min(1860, len(lines))):
    print(f'  L{i+1}: {repr(lines[i])}')

print(f'\nJSON validity:')
try:
    data = json.loads(content)
    print(f'  VALID')
    print(f'  accounts keys: {list(data.get("accounts", {}).keys())}')
    print(f'  Top keys: {sorted(data.keys())}')
except json.JSONDecodeError as e:
    print(f'  INVALID at pos {e.pos}: {e}')
    print(f'  Around error: {repr(content[e.pos-30:e.pos+30])}')
