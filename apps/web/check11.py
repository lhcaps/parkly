
import re

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')
lines = content.split('\n')

print('Lines 1782-1795:')
for i in range(1781, min(1795, len(lines))):
    print('  L' + str(i+1) + ':', repr(lines[i]))

# Find all top-level key positions (keys at indentation level 2, preceded by newline at start of file or after another top-level key)
print('\nAll top-level key positions:')
for m in re.finditer(b'  "([a-zA-Z0-9_]+)":', raw):
    key = m.group(1).decode()
    # Check if preceded by a top-level close
    before = raw[max(0, m.start()-10):m.start()]
    has_top_close = b'}\n' in before or before.endswith(b'}\n  "')
    print('  Byte ' + str(m.start()) + ' "' + key + '" - has_top_close:' + str(has_top_close))
    print('    Before: ' + repr(before[-30:]))
