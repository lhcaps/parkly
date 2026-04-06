
with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

# The issue: byte 73984 = '}' (closes accounts), byte 73985 = ',' (trailing comma - WRONG)
# The comma should be BEFORE the '}', not after
# Current: byte 73984='}', 73985=',', 73986='\r', 73987='\n', 73988=' ', 73989=' ', 73990='"'
# Pattern: '},\r\n  "'
# Fix: '}\r\n  "'

old = b'},\r\n  "'
new = b'}\r\n  "'

count = raw.count(old)
print(f'Occurrences of {repr(old)}: {count}')

if count > 0:
    idx = raw.rfind(old)
    print(f'Last occurrence at byte {idx}')
    print(f'Context: {repr(raw[idx:idx+30])}')
    new_raw = raw.replace(old, new, 1)
    with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'wb') as f:
        f.write(new_raw)
    print(f'Fixed! New size: {len(new_raw)}')
    print(f'Last 30 bytes: {new_raw[-30:]}')
else:
    print('Pattern not found')
