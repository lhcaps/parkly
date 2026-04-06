
with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
print(f'Total chars: {len(content)}')
print(f'Total lines from split: {len(lines)}')
print(f'Last 30 chars: {repr(content[-30:])}')

# Find the char position of line 1858 col 1
# Count chars until end of line 1857
pos = 0
for i in range(1857):
    pos = content.find('\n', pos) + 1
print(f'Char position of line 1858 col 1: {pos}')
print(f'Content at that position: {repr(content[pos:pos+10])}')

print(f'Line 1858 from split: {repr(lines[1857] if len(lines) > 1857 else "MISSING")}')
