
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

print(f'Total bytes: {len(raw)}')
print(f'Last 30 bytes: {raw[-30:]}')

# Check for JSON validity
content = raw.decode('utf-8-sig')
try:
    data = json.loads(content)
    print(f'JSON VALID! Top keys: {sorted(data.keys())}')
    print(f'accounts exists: {"accounts" in data}')
    if "accounts" in data:
        print(f'accounts has dialog: {"dialog" in data["accounts"]}')
except json.JSONDecodeError as e:
    print(f'JSON INVALID: {e}')
    print(f'Around error: {repr(content[e.pos-30:e.pos+30])}')
