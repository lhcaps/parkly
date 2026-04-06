
with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

# Find and fix the broken '"": {' pattern (should be '"dialog": {')
broken = b'  ": {\r\n'
fixed = b'  "dialog": {\r\n'

if broken in raw:
    print(f'Found broken pattern at byte {raw.find(broken)}')
    new_raw = raw.replace(broken, fixed, 1)
    with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'wb') as f:
        f.write(new_raw)
    print(f'Fixed! New size: {len(new_raw)}')
    print(f'Last 30 chars: {new_raw[-30:]}')
else:
    print('Broken pattern not found')
