import json

# Rebuild vi.json from scratch using valid en.json as template
en_path = r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json'
vi_path = r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/vi.json'

# Read valid en.json
with open(en_path, 'rb') as f:
    en_raw = f.read()

en_data = json.loads(en_raw.decode('utf-8-sig'))

# Vietnamese translations for the accountPage section
vi_account_page = {
    "pageTitle": "Tai khoan",
    "pageDesc": "Quan ly ho so nguoi dung, thong tin dang nhap va phan cong vai tro.",
    "tabs": {
        "myProfile": "Ho so cua toi",
        "admin": "Quan ly nguoi dung"
    },
    "profile": {
        "changePassword": "Doi mat khau",
        "changePasswordDesc": "Cap nhat mat khau tai khoan. Toi thieu 8 ky tu.",
        "newPassword": "Mat khau moi",
        "newPasswordPlaceholder": "Nhap mat khau moi",
        "confirmPassword": "Xac nhan mat khau",
        "confirmPasswordPlaceholder": "Nhap lai mat khau",
        "savePassword": "Luu mat khau",
        "passwordUpdated": "Mat khau da duoc cap nhat",
        "passwordRequired": "Vui long nhap mat khau moi",
        "passwordMinLength": "Mat khau phai co it nhat 8 ky tu",
        "passwordMismatch": "Mat khau xac nhan khong khop"
    },
    "admin": {
        "newUser": "Tao nguoi dung",
        "searchPlaceholder": "Tim kiem theo ten dang nhap...",
        "allStatuses": "Tat ca trang thai",
        "allRoles": "Tat ca vai tro",
        "statusActive": "Hoat dong",
        "statusDisabled": "Da vo hieu hoa",
        "refresh": "Lam moi",
        "clearFilters": "Xoa bo loc",
        "loading": "Dang tai...",
        "results": "{{count}} nguoi dung",
        "previous": "Truoc",
        "next": "Tiep",
        "page": "Trang {{page}}",
        "editUser": "Sua nguoi dung",
        "editUserDesc": "Cap nhat ten dang nhap, vai tro hoac dat lai mat khau cho {{username}}.",
        "setSiteScopes": "Pham vi trang",
        "setSiteScopesDesc": "Gan hoac xoa pham vi truy cap trang cho {{username}}.",
        "setSiteScopesUpdated": "Da cap nhat pham vi trang cho {{username}}",
        "disable": "Vo hieu hoa",
        "enable": "Kich hoat",
        "userDisabled": "{{username}} da bi vo hieu hoa",
        "userEnabled": "{{username}} da duoc kich hoat",
        "revokeSessions": "Thu hoi phien",
        "sessionsRevoked": "{{count}} phien hoat dong da bi thu hoi",
        "userUpdated": "Da cap nhat: {{username}}",
        "userCreated": "Da tao: {{username}}",
        "noUsers": "Khong tim thay nguoi dung",
        "noUsersDesc": "Thu thay doi bo loc hoac tao nguoi dung moi.",
        "noSitesAvailable": "Khong co trang nao kha dung",
        "username": "Ten dang nhap",
        "usernamePlaceholder": "VD: nguyen.van.a",
        "usernameMinLength": "Ten dang nhap phai co it nhat 3 ky tu",
        "usernameInvalid": "Ten dang nhap chi gom chu cai, so, dau gach ngang hoac gach duoi",
        "role": "Vai tro",
        "newPasswordOptional": "Mat khau moi (tuy chon)",
        "newPasswordPlaceholder": "De trong neu khong doi mat khau",
        "passwordLeaveBlank": "De trong de giu nguyen mat khau hien tai",
        "password": "Mat khau",
        "passwordPlaceholder": "Toi thieu 8 ky tu",
        "confirmPassword": "Xac nhan mat khau",
        "confirmPasswordPlaceholder": "Nhap lai mat khau",
        "passwordMinLength": "Mat khau phai co it nhat 8 ky tu",
        "passwordMismatch": "Mat khau xac nhan khong khop",
        "createUser": "Tao nguoi dung",
        "createUserDesc": "Tao tai khoan moi voi vai tro va pham vi trang tuy chon."
    },
    "dialog": {
        "cancel": "Huy",
        "save": "Luu thay doi"
    }
}

# en_data already has 'accountPage' (renamed earlier)

# Verify en
with open(en_path, 'rb') as f:
    en_raw2 = f.read()
en_check = json.loads(en_raw2.decode('utf-8-sig'))
print(f'en.json: VALID - accountPage exists: {"accountPage" in en_check}')
print(f'  accountPage keys: {sorted(en_check.get("accountPage", {}).keys())}')

# Now fix vi.json
# Read current (corrupt) vi.json
with open(vi_path, 'rb') as f:
    vi_raw = f.read()

# Find where the corruption starts
# The corruption is: everything after '},\r\n  "accounts": {' is wrong
# We need to find the CORRECT prefix of vi.json (everything before the corruption)

# Strategy: the valid part of vi.json is everything up to the mobileCaptureReceipt close
# with the comma. But we need to find where the StrReplace corruption started.

# The corruption boundary: at byte 82811, the file had '},\r\n  "accounts": {'
# But this was INSIDE the evidenceAlt value
# The CORRECT content of vi.json (before corruption) should be similar to en.json

# Approach: use the en.json structure to rebuild vi.json
# 1. Parse en.json (already done)
# 2. Copy all existing vi.json top-level keys that are still valid
# 3. Add/update accountPage

# The vi.json was CORRUPTED by StrReplace. The valid prefix is everything BEFORE the corruption.
# Let's find the last valid line in vi.json

# Check: the corruption starts at byte 82811
# Let's see what was at byte 82811 in the ORIGINAL file (before StrReplace)
# We need to figure out what the CORRECT content of mobileCaptureReceipt.evidenceAlt was

# Actually, the StrReplace operation replaced:
# OLD: '    "evidenceAlt": "capture evidence"'
# NEW: '    "evidenceAlt": "capture evidence"\n  },\n"accounts": {...}'
#
# So the StrReplace should have:
# 1. Kept: '    "evidenceAlt": "capture evidence"' 
# 2. Changed '  }' to '  },\n"accounts": {'
# 3. Added the accounts content
# 4. Removed the rest (but the rest was OUTSIDE the root after root closed)
#
# But the error says the file is corrupt. Let me check the byte-level:
# The file ends at byte 86396. But the VALID prefix should end at byte 82815 (the '},' after mobileCaptureReceipt).
# Bytes 82815-86396 are the corrupted part.
#
# The corruption:
# After 'evidenceAlt' was kept, the next bytes should be:
# '  }\n}\n' (close mobileCaptureReceipt, close root)
# But the StrReplace changed this to:
# '  },\n"accounts": {...corrupt...}\n}\n'
#
# So the CORRECT bytes should be:
# '  }\n}\n' (but the '  }' was changed to '  },\n"accounts"...')
#
# Fix: the CORRECT structure should be:
# [valid prefix up to and including '    "evidenceAlt": "capture evidence"']\n
# '  }\n}\n'
#
# BUT the file currently has:
# [valid prefix up to '    "evidenceAlt": "capture evidence"']\n
# '  },\n"accounts": {...}]\n}\n'
#
# The problem is: the '  }' that closed mobileCaptureReceipt was changed to '  },\n"accounts": {'
# So the CORRECT file would have:
# '    "evidenceAlt": "capture evidence"\n  }\n}\n'
#
# But we can't recover the original '}\n}\n' because we don't know the exact original content.
# However, we can REBUILD the vi.json from scratch:
# 1. Read the VALID vi.json prefix (everything BEFORE the corruption at byte 82811)
# 2. Truncate at that point
# 3. Add the correct closing

# Wait - let me re-check: is byte 82811 INSIDE the evidenceAlt value?
# The fix_vi_final.py output says: 'Context: b'g ghi nh\xe1\xba\xadn"\r\n  }\r\n},\r\n"accounts": {'
# 'g ghi nh\xe1\xba\xadn"\r\n  }\r\n' - this is Vietnamese text followed by '\r\n  }\r\n'
# Then '},\r\n' - this is the root close
# Then '"accounts": {' - accounts at root level
#
# So the CORRECT structure should be:
# 'g ghi nh\xe1\xba\xadn"\r\n  }\r\n}\r\n'
# But we have:
# 'g ghi nh\xe1\xba\xadn"\r\n  }\r\n},\r\n"accounts": {...invalid...}\r\n'
#
# The fix: remove the ',\r\n"accounts": {...invalid...}' part
# and keep '}\r\n'
#
# So: find '},\r\n"accounts": {' and remove everything from the ',' to the end of the file,
# then add '}\r\n'

old_pattern = b'},\r\n"accounts": {'
idx = raw.find(old_pattern)
if idx >= 0:
    print(f'Found pattern at byte {idx}')
    # Keep bytes before the ','
    # But we need to keep the '}' that closes mobileCaptureReceipt
    # The pattern is '},\r\n"accounts": {' - the ',' is at idx
    # The '}' before it is at idx-1
    # So valid_prefix = raw[:idx] (up to but NOT including the ',')
    # Then add '}\r\n}\r\n'
    valid_prefix = raw[:idx]  # up to '}'
    # But wait - valid_prefix ends with '  }' (closes mobileCaptureReceipt)
    # We need to change it to '  }\r\n}\r\n' (mobileCaptureReceipt close + root close)
    # valid_prefix might end with '\r\n  }' or just '}'
    # Let's check
    print(f'Valid prefix ends: {repr(valid_prefix[-30:])}')
    
    # Find the actual close: '    "evidenceAlt": "capture evidence"'
    # The evidenceAlt value ends, then comes the '  },' (close mobileCaptureReceipt)
    # The '}' at idx-1 closes mobileCaptureReceipt
    # The ',' at idx separates from accounts
    # After fixing: we need to add '\r\n}\r\n' after the '}'
    
    # valid_prefix = raw[:idx] (up to '}')
    # valid_prefix ends with '  }' (closes mobileCaptureReceipt)
    # We want: '  }\r\n}\r\n'
    # So we need to replace '  }' with '  }\r\n}\r\n'
    # OR: just add '  }\r\n}\r\n' after valid_prefix
    
    # valid_prefix might end with '\r\n  }' or '  }'
    # Strip trailing whitespace
    stripped = valid_prefix.rstrip()
    print(f'Stripped ends: {repr(stripped[-20:])}')
    
    # After stripping: should end with '  }' (mobileCaptureReceipt close)
    # Replace with proper closing
    # But the actual trailing content might be different
    # Let's just find where mobileCaptureReceipt closes and use that

# Strategy: find the last valid '    "evidenceAlt": "capture evidence"'
ea_idx = raw.rfind(b'"evidenceAlt":')
print(f'evidenceAlt at byte {ea_idx}')

# Find where that line ends
ea_line_end = raw.find(b'\r\n', ea_idx)
print(f'evidenceAlt line ends at byte {ea_line_end}')

# The next bytes should be '  }\r\n}\r\n' (mobileCaptureReceipt close, root close)
# But the file has '  },\r\n"accounts": {...}'
# So: raw[ea_line_end+2:] = '  },\r\n"accounts": {...}'
# We want it to be: '\r\n  }\r\n}\r\n'

valid_prefix2 = raw[:ea_line_end + 2]  # includes '\r\n'
# Now add: '  }\r\n}\r\n'
fixed = valid_prefix2 + b'  }\r\n}\r\n'

print(f'Fixed vi.json: {len(fixed)} bytes')
print(f'Last 40 bytes: {repr(fixed[-40:])}')

try:
    d = json.loads(fixed.decode('utf-8-sig'))
    print(f'VALID! Top keys: {sorted(d.keys())}')
    # Now add accountPage
    d['accountPage'] = vi_account_page
    # Write with CRLF
    output = json.dumps(d, ensure_ascii=False, indent=2).replace('\n', '\r\n')
    with open(vi_path, 'wb') as f:
        f.write(output.encode('utf-8'))
    print('Written successfully')
    
    # Validate final
    with open(vi_path, 'rb') as f:
        final = json.load(f)
    print(f'vi.json FINAL: VALID - accountPage keys: {sorted(final.get("accountPage", {}).keys())}')
except json.JSONDecodeError as e:
    print(f'STILL BROKEN: {e}')
