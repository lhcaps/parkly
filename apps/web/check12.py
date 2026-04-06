
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')
lines = content.split('\n')

print('Lines 71045-71060:')
for i in range(71045, min(71060, len(lines))):
    print('  L' + str(i+1) + ':', repr(lines[i]))

print('\nJSON validity:')
try:
    data = json.loads(content)
    print('JSON VALID!')
except json.JSONDecodeError as e:
    print('JSON INVALID:', e)
    print('pos:', e.pos)
    # Show what's happening
    # The issue: maybe there's a structural problem much earlier
    # Let's try to find the last valid JSON position
    
    # Find ALL occurrences of pattern where a top-level key is NOT followed by its proper structure
    # Scan through JSON manually, tracking brace depth
    depth = 0
    last_top_key_pos = 0
    last_comma_pos = 0
    i = 0
    
    while i < len(content):
        ch = content[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
        elif ch == ',':
            if depth == 1:
                last_comma_pos = i
        i += 1
    
    print('\nManual scan:')
    print('  Total chars:', len(content))
    print('  Last comma at depth 1: pos', last_comma_pos)
    
    # Check the end of file
    print('\nLast 200 chars:')
    print(repr(content[-200:]))
