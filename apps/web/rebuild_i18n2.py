import json

def fix_file(path, translations):
    with open(path, 'rb') as f:
        raw = f.read()
    
    try:
        data = json.loads(raw.decode('utf-8-sig'))
    except json.JSONDecodeError as e:
        print(f'{path}: Invalid JSON - {e}')
        return False
    
    # Rename existing root-level "accounts" to "accountPage"
    if 'accounts' in data and isinstance(data['accounts'], dict):
        account_data = data.pop('accounts')
        data['accountPage'] = account_data
    
    # Apply translations to accountPage
    if 'accountPage' not in data:
        data['accountPage'] = {}
    
    for key, value in translations.items():
        data['accountPage'][key] = value
    
    # Write back with CRLF
    output = json.dumps(data, ensure_ascii=False, indent=2)
    output = output.replace('\n', '\r\n')
    with open(path, 'wb') as f:
        f.write(output.encode('utf-8'))
    
    # Validate
    with open(path, 'rb') as f:
        raw2 = f.read()
    try:
        d = json.loads(raw2.decode('utf-8-sig'))
        print(f'{path}: VALID - accountPage keys: {sorted(d.get("accountPage", {}).keys())}')
        return True
    except json.JSONDecodeError as e2:
        print(f'{path}: STILL INVALID - {e2}')
        return False

en_translations = {
    "pageTitle": "Accounts",
    "pageDesc": "Manage user profiles, credentials, and role assignments.",
    "tabs": {
        "myProfile": "My Profile",
        "admin": "User Management"
    },
    "profile": {
        "changePassword": "Change Password",
        "changePasswordDesc": "Update your account password. Minimum 8 characters.",
        "newPassword": "New password",
        "newPasswordPlaceholder": "Enter new password",
        "confirmPassword": "Confirm password",
        "confirmPasswordPlaceholder": "Re-enter password",
        "savePassword": "Save password",
        "passwordUpdated": "Password updated successfully",
        "passwordRequired": "New password is required",
        "passwordMinLength": "Password must be at least 8 characters",
        "passwordMismatch": "Passwords do not match"
    },
    "admin": {
        "newUser": "New User",
        "searchPlaceholder": "Search by username…",
        "allStatuses": "All statuses",
        "allRoles": "All roles",
        "statusActive": "Active",
        "statusDisabled": "Disabled",
        "refresh": "Refresh",
        "clearFilters": "Clear filters",
        "loading": "Loading…",
        "results": "{{count}} users",
        "previous": "Previous",
        "next": "Next",
        "page": "Page {{page}}",
        "editUser": "Edit user",
        "editUserDesc": "Update username, role, or reset password for {{username}}.",
        "setSiteScopes": "Site scopes",
        "setSiteScopesDesc": "Assign or remove site access scopes for {{username}}.",
        "setSiteScopesUpdated": "Site scopes updated for {{username}}",
        "disable": "Disable",
        "enable": "Enable",
        "userDisabled": "{{username}} has been disabled",
        "userEnabled": "{{username}} has been enabled",
        "revokeSessions": "Revoke sessions",
        "sessionsRevoked": "{{count}} active session(s) revoked",
        "userUpdated": "User updated: {{username}}",
        "userCreated": "User created: {{username}}",
        "noUsers": "No users found",
        "noUsersDesc": "Try adjusting the filters or create a new user.",
        "noSitesAvailable": "No sites available",
        "username": "Username",
        "usernamePlaceholder": "e.g. john.doe",
        "usernameMinLength": "Username must be at least 3 characters",
        "usernameInvalid": "Username must be alphanumeric, dash, or underscore",
        "role": "Role",
        "newPasswordOptional": "New password (optional)",
        "newPasswordPlaceholder": "Leave blank to keep current password",
        "passwordLeaveBlank": "Leave blank to keep the current password unchanged",
        "password": "Password",
        "passwordPlaceholder": "Minimum 8 characters",
        "confirmPassword": "Confirm password",
        "confirmPasswordPlaceholder": "Re-enter password",
        "passwordMinLength": "Password must be at least 8 characters",
        "passwordMismatch": "Passwords do not match",
        "createUser": "Create User",
        "createUserDesc": "Create a new user account with a role and optional site scopes."
    },
    "dialog": {
        "cancel": "Cancel",
        "save": "Save changes"
    }
}

vi_translations = {
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

en_path = 'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json'
vi_path = 'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/vi.json'

print("=== Fixing en.json ===")
fix_file(en_path, en_translations)

print("\n=== Fixing vi.json ===")
fix_file(vi_path, vi_translations)
