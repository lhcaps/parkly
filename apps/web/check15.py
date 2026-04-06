
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')
lines = content.split('\n')

# Track the nesting depth for each line
depth = 0
line_depths = []
for i, line in enumerate(lines):
    stripped = line.rstrip('\r\n')
    # Count braces in this line
    open_count = stripped.count('{')
    close_count = stripped.count('}')
    depth += open_count
    line_depths.append(depth)
    depth -= close_count

# Find lines at depth 1 (top-level)
print('Top-level lines (depth 1):')
for i, ld in enumerate(line_depths):
    if ld == 1:
        print('  L' + str(i+1) + ' (depth 1): ' + repr(lines[i][:80]))

# Find lines at depth 0 (file root close)
print('\nRoot-close lines (depth 0):')
for i, ld in enumerate(line_depths):
    if ld == 0:
        print('  L' + str(i+1) + ' (depth 0): ' + repr(lines[i][:80]))

# Check: what are lines 1852-1858 depths?
print('\nLines 1852-1858 depths:')
for i in range(1851, min(1858, len(lines))):
    print('  L' + str(i+1) + ' (depth ' + str(line_depths[i]) + '): ' + repr(lines[i]))

# Now try: find where accounts closes (the line where accounts closes)
# accounts opens at L1786 (depth 1)
# accounts should close at depth 1 level
for i in range(1785, len(line_depths)):
    if line_depths[i] == 1 and '{' not in lines[i]:
        # This is a closing brace at depth 1
        stripped = lines[i].rstrip('\r\n')
        if stripped == '  }':
            print('\naccounts closes at L' + str(i+1) + ': ' + repr(lines[i]))
            print('Next 5 lines:')
            for j in range(i+1, min(i+6, len(lines))):
                print('  L' + str(j+1) + ' (depth ' + str(line_depths[j]) + '): ' + repr(lines[j]))
            break

# Check: is accounts INSIDE mobileCaptureReceipt?
print('\n\nCheck: is accounts inside mobileCaptureReceipt?')
# mobileCaptureReceipt opens at L1772
# accounts opens at L1786
# We need to check the depth at L1786
print('  L1786 depth:', line_depths[1785])
print('  L1772 depth:', line_depths[1771])

# mobileCaptureReceipt should close at some line where depth drops back
for i in range(1771, 1800):
    if line_depths[i] == 1 and '{' not in lines[i]:
        print('  mobileCaptureReceipt might close at L' + str(i+1) + ' (depth 1): ' + repr(lines[i]))
        break
