
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')

try:
    data = json.loads(content)
    print('JSON VALID! Top keys:', sorted(data.keys()))
    print('accounts exists:', 'accounts' in data)
except json.JSONDecodeError as e:
    print('JSON INVALID:', e)
    
    # Show exact error location byte-by-byte
    pos = e.pos
    print('\nByte-by-byte around error:')
    for i in range(max(0, pos-20), min(len(raw), pos+20)):
        b = raw[i]
        if 32 <= b < 127:
            ch = chr(b)
        elif b == 13:
            ch = '\\r'
        elif b == 10:
            ch = '\\n'
        else:
            ch = '<b'+str(b)+'>'
        marker = '>>> ' if i == pos else '    '
        print(marker + 'Byte ' + str(i) + ': ' + str(b) + ' = ' + ch)

    # Show last few bytes of JSON parseable content
    print('\nLast 200 bytes of raw:')
    print(raw[-200:])
    
    # Try to find where valid JSON ends
    # Look for the pattern '}\r\n}\r\n' at the end
    print('\nLast 100 bytes (decoded):')
    print(repr(content[-100:]))
