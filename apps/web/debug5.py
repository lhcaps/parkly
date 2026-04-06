
with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

print(f'Total bytes: {len(raw)}')
print(f'Last 20 bytes: {raw[-20:]}')

# Find all '}' bytes near end
for i in range(len(raw)-30, len(raw)):
    print(f'  Byte {i}: {repr(bytes([raw[i]]))} ({chr(raw[i]) if raw[i] < 128 else "B"+str(raw[i])})')

# Check if there's a brace inside the content (not just at end)
# The error position 73992 = len(content) = file has trailing content after JSON ends
print(f'\nContent at bytes 73980-74064:')
for i in range(73980, min(74064, len(raw))):
    b = raw[i]
    char = chr(b) if 32 <= b < 127 else f'<{b}>'
    print(f'  Byte {i}: {repr(bytes([b]))} = {repr(char)}')
