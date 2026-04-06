import json

for path in [
    r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/en.json',
    r'c:/Users/ADMIN/Desktop/Parkly/parkly/parkly/apps/web/src/i18n/locales/vi.json'
]:
    try:
        with open(path, 'rb') as f:
            d = json.load(f)
        print(path.split('/')[-1] + ': VALID')
        print('  accountPage keys: ' + str(sorted(d.get('accountPage',{}).keys())))
        print('  route.accountNav: ' + str(d.get('route',{}).get('accountNav','MISSING')))
    except Exception as e:
        print(path.split('/')[-1] + ': ERROR - ' + str(e))
