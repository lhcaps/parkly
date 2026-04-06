
import json
import sys

# Try reading the file with different approaches
paths = [
    r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json',
    r'c:\Users\ADMIN\Desktop\Parkly\parkly\parkly\apps\web\src\i18n\locales\en.json',
]

for path in paths:
    try:
        with open(path, 'rb') as f:
            raw_bytes = f.read()
        print(f'Path: {path}')
        print(f'  Total bytes: {len(raw_bytes)}')
        print(f'  Last 50 bytes: {raw_bytes[-50:]}')
        
        # Try UTF-8
        content = raw_bytes.decode('utf-8-sig')  # strip BOM if any
        print(f'  UTF-8-SIG decode: {len(content)} chars')
        
        # Try parsing
        try:
            data = json.loads(content)
            print(f'  JSON valid: YES, top keys: {sorted(data.keys())}')
        except json.JSONDecodeError as e:
            print(f'  JSON valid: NO - {e}')
            # Find position
            err_pos = e.pos
            print(f'  Error pos: {err_pos}, lineno: {e.lineno}, colno: {e.colno}')
            print(f'  Around error: {repr(content[max(0,err_pos-20):err_pos+20])}')
    except Exception as e:
        print(f'Path: {path} - ERROR: {e}')

# Also read raw bytes around position 72135
with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()
print(f'\nTotal raw bytes: {len(raw)}')
print(f'Bytes 72120-72150: {raw[72120:72150]}')
print(f'Bytes 72130-72140: {raw[72130:72140]}')

# Check if file has more content after what python thinks is end
print(f'\nLast 10 bytes: {raw[-10:]}')
