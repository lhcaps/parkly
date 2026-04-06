
import json

with open(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8-sig')

try:
    data = json.loads(content)
    print('JSON VALID! Top keys:', sorted(data.keys()))
except json.JSONDecodeError as e:
    print('JSON INVALID:', e)
    print('pos:', e.pos)
    
    # Count newlines BEFORE the error position
    before_error = content[:e.pos]
    newlines_before = before_error.count('\n')
    print('Newlines before error pos:', newlines_before)
    print('So error is on line (1-indexed):', newlines_before + 1)
    
    # Split by newlines
    split_lines = content.split('\n')
    print('Total split lines:', len(split_lines))
    print('Error line (split idx', newlines_before, '):', repr(split_lines[newlines_before]))
    
    # But what if the split_idx is different?
    # Maybe the JSON parser counts \r\n differently
    # Let's check: the actual line 73992 falls in which split line?
    # We know char 73992 corresponds to line 1858 col 1 in JSON parser's counting
    # So JSON parser counts 1857 lines before char 73992
    # That means byte 73992 is on line 1858 (1-indexed) of JSON parser
    
    # But from Python split: we have 1858 total lines
    # Lines 1-1857 map to split indices 0-1856
    # Line 1858 in JSON parser = split idx 1857 = ''
    
    # So char 73992 in JSON parser = the '\n' that ends line 1857?
    # Or is it the next character?
    
    # Let me check: is there something at the very end of the file?
    print('\nLast 20 bytes:', repr(raw[-20:]))
    print('Last char decoded:', repr(content[-1:]))
    print('Second-to-last char:', repr(content[-2:-1]))
    print('Third-to-last char:', repr(content[-3:-2]))
    
    # Let's check if the file ends with a trailing newline AFTER the JSON
    # Find any content after the last '}\n'
    idx = content.rfind('}\n')
    if idx >= 0:
        print('\nLast "}\n" at pos', idx)
        print('After it:', repr(content[idx+2:idx+20]))
    
    # Maybe the issue is that accounts closes at byte 73984 ('}')
    # But then there's ',\n  "dialog"' instead of '\n  "dialog"'
    # That's why the JSON parser sees char 73992 as the 'i' in "dialog"
    # and reports it as line 1858 col 1?
    # 
    # Let me verify: the trailing comma makes the JSON parser think accounts is still open
    # When it sees the closing brace, it expects the comma before it
    # But char 73992 being 'i' means the error position is AFTER the opening quote of "dialog"
    # 
    # Actually, I think the issue might be simpler:
    # The JSON parser sees '},\r\n  "dialog": {...' 
    # When it closes accounts with '}', it expects the value
    # but finds ',' instead (which is after '}' in '},')
    # Then it sees 'dialog', and expects a comma before the value 'dialog'
    # But finds ':' instead...
    # 
    # OR: the JSON parser finishes parsing accounts at '}' (byte 73984)
    # Then it finds ',' (byte 73985) - this is fine as a comma after accounts value
    # Then it finds '"' (start of "dialog") at byte 73990
    # But byte 73985-73989 = ',\r\n  '
    # The JSON parser successfully parses accounts!
    # Then it sees the comma at 73985, and expects the NEXT top-level key-value pair
    # So it should find '"key": {' but instead it finds... 
    # Byte 73986-73989 = '\r\n  '
    # Byte 73990-73996 = '"dialog"'
    # Byte 73997 = ':'
    # Byte 73998 = ' '
    # Byte 73999 = '{'
    # 
    # So "dialog": { should be fine...
    # 
    # UNLESS... the JSON parser is reading the file differently!
    # Maybe there's a different interpretation...
    # 
    # Let me check: what if the file has a UTF-16 BOM or something?
    print('\nFirst 10 bytes:', repr(raw[:10]))
    
    # What if the StrReplace tool wrote the file with different encoding?
    # Let me check for any encoding issues
    # Try reading as different encodings
    for enc in ['utf-8', 'utf-8-sig', 'utf-16', 'utf-16-le', 'utf-16-be', 'latin-1']:
        try:
            test = raw.decode(enc)
            if enc == 'utf-8' and test != content:
                print('\n' + enc + ' differs from raw bytes!')
        except:
            pass
    
    # Let me just try to build a corrected version
    # Find the issue by brute force: truncate the file at various points and check validity
    print('\nTruncation test:')
    for truncate_at in [73900, 73950, 73980, 73984, 73990, 73999, 74000, 74010, 74020]:
        test_content = content[:truncate_at]
        try:
            data = json.loads(test_content)
            print('  Truncate at ' + str(truncate_at) + ': VALID (len=' + str(len(test_content)) + ')')
            break
        except json.JSONDecodeError as e2:
            print('  Truncate at ' + str(truncate_at) + ': INVALID (' + str(e2)[:40] + ')')
