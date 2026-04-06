
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')

# Find the error position and show what's happening there
# The error is at line 1858 col 1 = char 73992
print('Total chars:', len(content))
print('Char 73992:', repr(content[73992]) if len(content) > 73992 else 'EOF')
print('Char 73991:', repr(content[73991]) if len(content) > 73991 else 'EOF')
print('Char 73990:', repr(content[73990]) if len(content) > 73990 else 'EOF')

print('\nLast 50 chars:', repr(content[-50:]))

# Check: is there content AFTER the accounts closing }?
# Find where accounts closes
accounts_close = content.rfind('}\n')
print('\nLast } before EOF at char:', accounts_close)
print('Content after accounts close:', repr(content[accounts_close:accounts_close+30]))

# Check for JSON validity
try:
    data = json.loads(content)
    print('\nJSON VALID!')
except json.JSONDecodeError as e:
    print('\nJSON INVALID:', e)
    print('pos:', e.pos, 'lineno:', e.lineno, 'colno:', e.colno)
    
    # Walk through from beginning to error, showing brace tracking
    lines = content.split('\n')
    print('\nLast 10 lines:')
    for i in range(max(0, len(lines)-10), len(lines)):
        print('  L' + str(i+1) + ':', repr(lines[i]))
    
    # Show exact byte range
    print('\nBytes 73970-74000:')
    for i in range(73970, min(74000, len(raw))):
        b = raw[i]
        print('  Byte', i, ':', b, '=', repr(bytes([b])) if 32 <= b < 127 else '<b'+str(b)+'>')
