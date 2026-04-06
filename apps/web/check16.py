
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')
lines = content.split('\n')

# Let me count actual braces to understand nesting
# Start at depth 0 (outside any object)
depth = 0
max_depth_seen = 0
line_depths = []
for i, line in enumerate(lines):
    stripped = line.rstrip('\r\n')
    # Count braces in THIS line
    open_in_line = stripped.count('{')
    close_in_line = stripped.count('}')
    
    # The depth BEFORE processing this line
    line_depths.append(depth)
    
    # Process all opens first, then closes
    # Track max depth
    for j in range(open_in_line):
        if depth + j + 1 > max_depth_seen:
            max_depth_seen = depth + j + 1
    
    depth += open_in_line
    depth -= close_in_line

print('Max depth seen:', max_depth_seen)
print()

# Now show lines 1770-1795
print('Lines 1770-1795:')
for i in range(1769, min(1795, len(lines))):
    print('  L' + str(i+1) + ' (d=' + str(line_depths[i]) + '): ' + repr(lines[i][:80]))

# Show lines 1848-1858
print('\nLines 1848-1858:')
for i in range(1847, min(1858, len(lines))):
    print('  L' + str(i+1) + ' (d=' + str(line_depths[i]) + '): ' + repr(lines[i][:80]))

# The issue: accounts should be at depth 2 (top-level, inside root)
# But where is accounts opened?
# And where is it closed?
print('\n\nKey insight:')
print('L1786 "accounts" is at depth', line_depths[1785])
print('L1852 "}" (closing) is at depth', line_depths[1851])
print('L1853 "dialog" is at depth', line_depths[1852])
print()

# Let's find where depth is 1 (root level)
print('Root-level lines (depth 1):')
for i, ld in enumerate(line_depths):
    if ld == 1:
        stripped = lines[i].rstrip('\r\n')
        print('  L' + str(i+1) + ': ' + repr(stripped[:80]))

# The problem: L1857 "}" closes something at depth 2
# If accounts is at depth 2 (L1786), and the root is at depth 1 (L1)
# Then L1857 "}" should close accounts
# But then L1853 "dialog" is ALSO at depth 3? Let me recheck
print('\nRecounting:')
# Start depth at 0
d = 0
for i in range(0, 1790):
    stripped = lines[i].rstrip('\r\n')
    opens = stripped.count('{')
    closes = stripped.count('}')
    print('L' + str(i+1) + ' (d=' + str(d) + '): opens=' + str(opens) + ' closes=' + str(closes) + ' -> ', end='')
    d += opens
    print('d=' + str(d), end='')
    d -= closes
    print(' final d=' + str(d))
    if i > 1789:
        pass  # don't print all
