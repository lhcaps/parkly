import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')

# Find the root-level accounts
# Track depth
lines = content.split('\n')
depth = 0
d_before = []
for line in lines:
    stripped = line.rstrip('\r\n')
    d_before.append(depth)
    depth += stripped.count('{')
    depth -= stripped.count('}')

# Find root-level accounts (d_before=1)
for i, d in enumerate(d_before):
    stripped = lines[i].rstrip('\r\n')
    if d == 1 and stripped.startswith('  "accounts":'):
        print(f'accounts opens at L{i+1}, d_before={d}')
        # Find where it closes (depth back to 1)
        for j in range(i+1, len(lines)):
            stripped2 = lines[j].rstrip('\r\n')
            if d_before[j] == 1 and stripped2 == '  }':
                print(f'accounts closes at L{j+1}: {repr(stripped2)}')
                # Check what follows
                if j+1 < len(lines):
                    print(f'  Line after: L{j+2}: {repr(lines[j+1])}')
                break
        break

# Check: is there a comma after the last property before accounts?
# Find all root-level closings '  }'
print('\nRoot-level closes:')
for i, d in enumerate(d_before):
    stripped = lines[i].rstrip('\r\n')
    if d == 1 and stripped == '  }':
        # Find what property this closes
        # Find the previous root-level property
        prev_root = -1
        for j in range(i-1, -1, -1):
            stripped2 = lines[j].rstrip('\r\n')
            if d_before[j] == 1:
                prev_root = j
                break
        prev_content = lines[prev_root].rstrip('\r\n') if prev_root >= 0 else ''
        print(f'  L{i+1} closes root. Last root-level prop: L{prev_root+1}: {repr(prev_content[:60])} - has comma: {prev_content.endswith(b",")}')
