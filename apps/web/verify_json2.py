
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')

print(f'Total bytes: {len(content)}')
print(f'Last 30 chars: {repr(content[-30:])}')

try:
    data = json.loads(content)
    print(f'JSON VALID! Top keys: {sorted(data.keys())}')
    print(f'accounts exists: {"accounts" in data}')
except json.JSONDecodeError as e:
    print(f'JSON INVALID: {e}')
    print(f'Around error: {repr(content[e.pos-30:e.pos+30])}')

# Check what objects exist in the file
lines = content.split('\n')
print(f'\nLines 1785-1795:')
for i in range(1784, min(1795, len(lines))):
    print(f'  L{i+1}: {repr(lines[i])}')

print(f'\nLines around accounts end:')
# Find line number of 'createUserDesc'
for i, l in enumerate(lines):
    if '"createUserDesc"' in l:
        print(f'  createUserDesc at L{i+1}')
        for j in range(max(0, i-2), min(len(lines), i+10)):
            print(f'    L{j+1}: {repr(lines[j])}')
        break
