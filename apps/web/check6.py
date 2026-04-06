
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')
lines = content.split('\n')

print(f'Lines 1-20:')
for i in range(0, min(20, len(lines))):
    print(f'  L{i+1}: {repr(lines[i])}')

try:
    data = json.loads(content)
    print(f'\nJSON VALID!')
except json.JSONDecodeError as e:
    print(f'\nJSON INVALID: {e}')
    print(f'lineno: {e.lineno}, colno: {e.colno}, pos: {e.pos}')
    print(f'Around error: {repr(content[e.pos-50:e.pos+50])}')
    # Show error line
    for i in range(max(0, e.lineno-5), min(len(lines), e.lineno+3)):
        marker = '>>> ' if i+1 == e.lineno else '    '
        print(f'{marker}L{i+1}: {repr(lines[i])}')
