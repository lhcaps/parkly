import json

# Just check current state of en.json
with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')
lines = content.split('\n')

print(f'Total lines: {len(lines)}')
print(f'Total chars: {len(content)}')

# Track depth
depth = 0
d_before = []
for line in lines:
    stripped = line.rstrip('\r\n')
    d_before.append(depth)
    depth += stripped.count('{')
    depth -= stripped.count('}')

# Find ALL lines that mention "accounts"
print('\nALL lines mentioning "accounts":')
for i, line in enumerate(lines):
    if 'accounts' in line:
        print(f'  L{i+1} (d_before={d_before[i]}): {repr(line[:80])}')

# Find ALL lines at depth 1 (root level)
print('\nALL root-level lines (d_before=1):')
for i, d in enumerate(d_before):
    if d == 1:
        stripped = lines[i].rstrip('\r\n')
        print(f'  L{i+1}: {repr(stripped[:80])}')

# Validate JSON
try:
    d = json.loads(content)
    print('\nJSON VALID!')
    print('Top keys:', sorted(d.keys()))
except json.JSONDecodeError as e:
    print(f'\nJSON INVALID: {e}')
    print(f'pos: {e.pos}, lineno: {e.lineno}, colno: {e.colno}')
    
    # Show the error line
    lines = content.split('\n')
    before = content[:e.pos]
    error_line = before.count('\n') + 1
    error_col = e.pos - before.rfind('\n')
    print(f'Error at line {error_line}, col {error_col}')
    
    if error_line <= len(lines):
        for i in range(max(0, error_line-5), min(len(lines), error_line+3)):
            marker = '>>> ' if i+1 == error_line else '    '
            print(f'{marker}L{i+1}: {repr(lines[i])}')
