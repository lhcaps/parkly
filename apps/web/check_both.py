import json

def safe_check(path, label):
    try:
        with open(path, 'rb') as f:
            raw = f.read()
        content = raw.decode('utf-8-sig')
        try:
            d = json.loads(content)
            print(label + ': VALID')
            print('  Top keys:', sorted(d.keys()))
            print('  accountPage exists:', 'accountPage' in d)
            print('  accounts (route) exists:', 'accounts' in d.get('route', {}))
            return True
        except json.JSONDecodeError as e:
            print(label + ': INVALID - ' + str(e))
            print('  Error pos:', e.pos)
            lines = content.split('\n')
            before = content[:e.pos]
            err_line = before.count('\n') + 1
            print('  Error at line:', err_line)
            for i in range(max(0, err_line-5), min(len(lines), err_line+3)):
                marker = '>>> ' if i+1 == err_line else '    '
                try:
                    print(marker + 'L' + str(i+1) + ': ' + repr(lines[i][:80]))
                except:
                    print(marker + 'L' + str(i+1) + ': [unicode error]')
            return False
    except Exception as e:
        print(label + ': ERROR - ' + str(e))
        return False

en = r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json'
vi = r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/vi.json'

print('=== en.json ===')
safe_check(en, 'en.json')

print('\n=== vi.json ===')
safe_check(vi, 'vi.json')

# Check counts
for path, label in [(en, 'en.json'), (vi, 'vi.json')]:
    with open(path, 'rb') as f:
        raw = f.read()
    content = raw.decode('utf-8-sig')
    lines = content.split('\n')
    
    # Count root-level keys
    depth = 0
    d_before = []
    for line in lines:
        stripped = line.rstrip('\r\n')
        d_before.append(depth)
        depth += stripped.count('{')
        depth -= stripped.count('}')
    
    root_keys = []
    for i, d in enumerate(d_before):
        stripped = lines[i].rstrip('\r\n')
        if d == 1 and stripped.startswith('  "') and ': {' in stripped:
            key = stripped.split('":')[0].strip().replace('"', '')
            root_keys.append(key)
    
    print(f'\n{label} root keys: {root_keys}')
