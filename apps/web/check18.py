
import re

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')
lines = content.split('\n')

# Find where accounts closes (last line of accounts content)
# Track depth
depth = 0
depth_at_line = []
for line in lines:
    stripped = line.rstrip('\r\n')
    opens = stripped.count('{')
    closes = stripped.count('}')
    depth_at_line.append(depth)
    depth += opens
    depth -= closes

# Find all "at depth 1, is a closing brace" lines
print('Lines where depth before is 1 AND content is just "  }":')
for i, d in enumerate(depth_at_line):
    if d == 1:
        stripped = lines[i].rstrip('\r\n')
        if stripped == '  }':
            print('  L' + str(i+1) + ' (depth 1 before): ' + repr(lines[i]))

# Find where accounts starts (depth 1 before, then opens)
print('\nLines where depth before is 1 AND opens an object:')
for i, d in enumerate(depth_at_line):
    if d == 1:
        stripped = lines[i].rstrip('\r\n')
        if stripped.endswith('": {') or stripped.endswith('": {\\r') or stripped.endswith('": {\\n'):
            print('  L' + str(i+1) + ' (depth 1 before): ' + repr(lines[i][:80]))

# Show lines 1785-1860 with their depth
print('\nLines 1785-1860:')
for i in range(1784, min(1860, len(lines))):
    print('  L' + str(i+1) + ' (d=' + str(depth_at_line[i]) + '): ' + repr(lines[i][:80]))
