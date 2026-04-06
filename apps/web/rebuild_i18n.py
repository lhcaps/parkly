import json

def build_account_page_section():
    """Build the accountPage section for i18n files."""
    return {
        "tabs": {
            "myProfile": "",  # Override per language
            "admin": ""
        },
        "profile": {
            "changePassword": "",
            "changePasswordDesc": "",
            "newPassword": "",
            "newPasswordPlaceholder": "",
            "confirmPassword": "",
            "confirmPasswordPlaceholder": "",
            "savePassword": "",
            "passwordUpdated": "",
            "passwordRequired": "",
            "passwordMinLength": "",
            "passwordMismatch": ""
        },
        "admin": {
            "newUser": "",
            "searchPlaceholder": "",
            "allStatuses": "",
            "allRoles": "",
            "statusActive": "",
            "statusDisabled": "",
            "refresh": "",
            "clearFilters": "",
            "loading": "",
            "results": "",
            "previous": "",
            "next": "",
            "page": "",
            "editUser": "",
            "editUserDesc": "",
            "setSiteScopes": "",
            "setSiteScopesDesc": "",
            "setSiteScopesUpdated": "",
            "disable": "",
            "enable": "",
            "userDisabled": "",
            "userEnabled": "",
            "revokeSessions": "",
            "sessionsRevoked": "",
            "userUpdated": "",
            "userCreated": "",
            "noUsers": "",
            "noUsersDesc": "",
            "noSitesAvailable": "",
            "username": "",
            "usernamePlaceholder": "",
            "usernameMinLength": "",
            "usernameInvalid": "",
            "role": "",
            "newPasswordOptional": "",
            "newPasswordPlaceholder": "",
            "passwordLeaveBlank": "",
            "password": "",
            "passwordPlaceholder": "",
            "confirmPassword": "",
            "confirmPasswordPlaceholder": "",
            "passwordMinLength": "",
            "passwordMismatch": "",
            "createUser": "",
            "createUserDesc": ""
        },
        "dialog": {
            "cancel": "",
            "save": ""
        },
        "pageTitle": "",
        "pageDesc": ""
    }

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
        data['accountPage'] = build_account_page_section()
    
    for key, value in translations.items():
        if key in data['accountPage']:
            data['accountPage'][key] = value
    
    # Write back
    output = json.dumps(data, ensure_ascii=False, indent=2)
    # Ensure CRLF
    output = output.replace('\n', '\r\n')
    with open(path, 'wb') as f:
        f.write(output.encode('utf-8'))
    
    # Validate
    with open(path, 'rb') as f:
        raw2 = f.read()
    try:
        d = json.loads(raw2.decode('utf-8-sig'))
        print(f'{path}: VALID - keys: {sorted(d.keys())}')
        print(f'  accountPage: {"accountPage" in d}')
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
    "pageTitle": "Tài khoản",
    "pageDesc": "Quản lý hồ sơ người dùng, thông tin đăng nhập và phân công vai trò.",
    "tabs": {
        "myProfile": "Hồ sơ của tôi",
        "admin": "Quản lý người dùng"
    },
    "profile": {
        "changePassword": "Đổi mật khẩu",
        "changePasswordDesc": "Cập nhật mật khẩu tài khoản. Tối thiểu 8 ký tự.",
        "newPassword": "Mật khẩu mới",
        "newPasswordPlaceholder": "Nhập mật khẩu mới",
        "confirmPassword": "Xác nhận mật khẩu",
        "confirmPasswordPlaceholder": "Nhập lại mật khẩu",
        "savePassword": "Lưu mật khẩu",
        "passwordUpdated": "Mật khẩu đã được cập nhật",
        "passwordRequired": "Vui lòng nhập mật khẩu mới",
        "passwordMinLength": "Mật khẩu phải có ít nhất 8 ký tự",
        "passwordMismatch": "Mật khẩu xác nhận không khớp"
    },
    "admin": {
        "newUser": "Tạo người dùng",
        "searchPlaceholder": "Tìm kiếm theo tên đăng nhập…",
        "allStatuses": "Tất cả trạng thái",
        "allRoles": "Tất cả vai trò",
        "statusActive": "Hoạt động",
        "statusDisabled": "Đã vô hiệu hóa",
        "refresh": "Làm mới",
        "clearFilters": "Xóa bộ lọc",
        "loading": "Đang tải…",
        "results": "{{count}} người dùng",
        "previous": "Trước",
        "next": "Tiếp",
        "page": "Trang {{page}}",
        "editUser": "Sửa người dùng",
        "editUserDesc": "Cập nhật tên đăng nhập, vai trò hoặc đặt lại mật khẩu cho {{username}}.",
        "setSiteScopes": "Phạm vi trang",
        "setSiteScopesDesc": "Gán hoặc xóa phạm vi truy cập trang cho {{username}}.",
        "setSiteScopesUpdated": "Đã cập nhật phạm vi trang cho {{username}}",
        "disable": "Vô hiệu hóa",
        "enable": "Kích hoạt",
        "userDisabled": "{{username}} đã bị vô hiệu hóa",
        "userEnabled": "{{username}} đã được kích hoạt",
        "revokeSessions": "Thu hồi phiên",
        "sessionsRevoked": "{{count}} phiên hoạt động đã bị thu hồi",
        "userUpdated": "Đã cập nhật: {{username}}",
        "userCreated": "Đã tạo: {{username}}",
        "noUsers": "Không tìm thấy người dùng",
        "noUsersDesc": "Thử thay đổi bộ lọc hoặc tạo người dùng mới.",
        "noSitesAvailable": "Không có trang nào khả dụng",
        "username": "Tên đăng nhập",
        "usernamePlaceholder": "VD: nguyen.van.a",
        "usernameMinLength": "Tên đăng nhập phải có ít nhất 3 ký tự",
        "usernameInvalid": "Tên đăng nhập chỉ gồm chữ cái, số, dấu gạch ngang hoặc gạch dưới",
        "role": "Vai trò",
        "newPasswordOptional": "Mật khẩu mới (tùy chọn)",
        "newPasswordPlaceholder": "Để trống nếu không đổi mật khẩu",
        "passwordLeaveBlank": "Để trống để giữ nguyên mật khẩu hiện tại",
        "password": "Mật khẩu",
        "passwordPlaceholder": "Tối thiểu 8 ký tự",
        "confirmPassword": "Xác nhận mật khẩu",
        "confirmPasswordPlaceholder": "Nhập lại mật khẩu",
        "passwordMinLength": "Mật khẩu phải có ít nhất 8 ký tự",
        "passwordMismatch": "Mật khẩu xác nhận không khớp",
        "createUser": "Tạo người dùng",
        "createUserDesc": "Tạo tài khoản mới với vai trò và phạm vi trang tùy chọn."
    },
    "dialog": {
        "cancel": "Hủy",
        "save": "Lưu thay đổi"
    }
}

print("=== Fixing en.json ===")
fix_file(r'c:/Users/ADMIN/Desktop/Parkly/parkly\parkly\apps\web\src\i18n\locales\en.json', en_translations)

print("\n=== Fixing vi.json ===")
fix_file(r'c:/Users/ADMIN\Desktop\Parkly\parkly\apps\web\src\i18n\locales\vi.json', vi_translations)
