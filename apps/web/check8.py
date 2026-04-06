
with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')

print('Total chars:', len(content))
print('Chars 140-150:', repr(content[140:150]))

print('\nLines 1-10:')
lines = content.split('\n')
for i in range(0, 10):
    print('  L' + str(i+1) + ':', repr(lines[i]))

# Find ALL occurrences of '  }\r\n  "'
p1 = b'  }\r\n  "'
p2 = b'  },\r\n  "'
print('\nPattern (no comma) count:', raw.count(p1))
print('Pattern (with comma) count:', raw.count(p2))

# Find occurrences
pos = 0
count = raw.count(p1)
print('Occurrences without comma:')
for i in range(count):
    idx = raw.find(p1, pos)
    print('  #' + str(i+1) + ' at byte', idx, ':', repr(raw[idx:idx+40]))
    pos = idx + 1
