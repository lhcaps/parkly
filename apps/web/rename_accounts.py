import json

def rename_root_accounts(json_path):
    with open(json_path, 'rb') as f:
        raw = f.read()
    content = raw.decode('utf-8-sig')
    lines = content.split('\n')

    # Track depth
    depth = 0
    d_before = []
    for line in lines:
        stripped = line.rstrip('\r\n')
        d_before.append(depth)
        depth += stripped.count('{')
        depth -= stripped.count('}')

    # Find the root-level accounts (d_before=1)
    root_accounts_start = -1
    root_accounts_end = -1
    for i, d in enumerate(d_before):
        stripped = lines[i].rstrip('\r\n')
        if d == 1 and stripped.startswith('  "accounts":'):
            root_accounts_start = i
            # Find where this root-level accounts closes
            for j in range(i+1, len(lines)):
                stripped2 = lines[j].rstrip('\r\n')
                if d_before[j] == 1 and stripped2 == '  }':
                    root_accounts_end = j
                    break
            break

    if root_accounts_start == -1:
        print(f'No root-level accounts found in {json_path}')
        return

    print(f'Root-level accounts at L{root_accounts_start+1}-L{root_accounts_end+1}')

    # Build new content with renamed section
    new_lines = []
    for i in range(len(lines)):
        if i == root_accounts_start:
            # Rename the opening key
            new_lines.append('  "accountPage": {\r')
        elif root_accounts_start < i <= root_accounts_end:
            # Skip this line (the opening key is replaced above)
            new_lines.append(lines[i])
        else:
            new_lines.append(lines[i])

    # Actually, I need to rename the "accounts" key on line root_accounts_start
    # All other lines (inside accounts) still use "accounts" as keys within the accountPage object
    # Those are fine - they're nested inside accountPage
    # Only the TOP-LEVEL "accounts": { needs to be "accountPage": {

    # Rebuild: take everything before root_accounts_start, then rename, then everything after
    new_lines = []
    for i in range(len(lines)):
        if i == root_accounts_start:
            # Rename "accounts": to "accountPage":
            line = lines[i]
            new_lines.append(line.replace('  "accounts": {', '  "accountPage": {', 1))
        else:
            new_lines.append(lines[i])

    fixed_content = '\n'.join(new_lines)
    # Don't add extra trailing newline since original ends with '}\r\n'
    # But the original now ends with '}\r\n}\r\n' after our append
    # Let's check: the content should be valid JSON

    try:
        d = json.loads(fixed_content)
        print(f'{json_path}: VALID')
        print(f'  accountPage keys: {sorted(d.get("accountPage", {}).keys())}')
        print(f'  accounts nested in route: {"accounts" in d.get("route", {})}')
        # Write back
        with open(json_path, 'wb') as f:
            f.write(fixed_content.encode('utf-8'))
        print(f'  Written successfully')
    except json.JSONDecodeError as e:
        print(f'{json_path}: STILL INVALID: {e}')

rename_root_accounts(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json')
rename_root_accounts(r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/vi.json')
