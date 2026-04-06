
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')

print(f'Total chars: {len(content)}')
print(f'Last 30 chars: {repr(content[-30:])}')

try:
    data = json.loads(content)
    print(f'JSON VALID! Top keys: {sorted(data.keys())}')
    print(f'accounts keys: {sorted(data.get("accounts", {}).keys())}')
except json.JSONDecodeError as e:
    print(f'JSON INVALID: {e}')
    print(f'lineno: {e.lineno}, colno: {e.colno}, pos: {e.pos}')
    # Show exact error location
    lines = content.split('\n')
    for i, l in enumerate(lines):
        if '"admin"' in l:
            print(f'\n"admin" line L{i+1}: {repr(l)}')
        if '"dialog"' in l:
            print(f'"dialog" line L{i+1}: {repr(l)}')
        if '"dialog"' in l and i < len(lines):
            print(f'Next line L{i+2}: {repr(lines[i+1])}')
        if i > 1845:
            print(f'  L{i+1}: {repr(l)}')
