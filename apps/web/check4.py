
import json
import re

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')

print(f'Total chars (UTF-8): {len(content)}')
print(f'Total bytes (raw): {len(raw)}')
print(f'File ends with (raw last 20): {repr(raw[-20:])}')

# Count lines by \n and \r\n
nl_count = content.count('\n')
crnl_count = content.count('\r\n')
print(f'Newlines \\n: {nl_count}')
print(f'CRLF \\r\\n: {crnl_count}')

# The JSON parser says "line 1858 column 1"
# But from Python's split('\n'), the file has 1858 lines (0..1857)
# Line 1858 in 1-indexed = split idx 1857 = last line (empty or just whitespace)
# Line 1857 in 1-indexed = split idx 1856 = '}'
# Line 1856 in 1-indexed = split idx 1855 = '  }'

# Let's find exactly where the JSON ends
# Try to parse incrementally
lines = content.split('\n')
print(f'\nLines 1854-1858:')
for i in range(1853, min(1858, len(lines))):
    print(f'  L{i+1}: {repr(lines[i])}')

# The JSON parser might be confused by a trailing \r in the last }
# Check: does '}\r' close the root? Or does it need '}\r\n'?
# Actually the issue is that the root closes at line 1857 = '}\r'
# But line 1858 is '' (empty string after trailing \n)
# JSON is whitespace-tolerant, so '' should be fine...

# Unless... there's content BETWEEN what we see as line 1857 and 1858
# Let me check bytes 73970-73992
print(f'\nBytes 73970-73992:')
for i in range(73970, min(73992, len(raw))):
    b = raw[i]
    print(f'  Byte {i}: {b:3d} = {repr(bytes([b]))} = {repr(chr(b)) if 32 <= b < 127 else f"<{b}>"}')

# Find ALL non-JSON content after the root closes
# Root closes at char 73984 (the '}' that closes the root after accounts)
# Position of root close
idx = content.rfind('}\n')  # Find last '}\n'
print(f'\nLast occurrence of "}}\\n" at position {idx}')
print(f'Content at that position: {repr(content[idx:idx+20])}')

# Actually let me check: where does the root object end?
# Find the last valid '}' of the root object
# Scan backward from end
for i in range(len(content)-1, max(0, len(content)-200), -1):
    ch = content[i]
    if ch not in '\r\n \t':
        print(f'Last non-whitespace at char {i}: {repr(ch)}')
        print(f'Around it: {repr(content[max(0,i-30):i+30])}')
        break
