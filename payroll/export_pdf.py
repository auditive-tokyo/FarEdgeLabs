import json, subprocess, urllib.request, urllib.parse, sys
T = subprocess.check_output(['gcloud','auth','print-access-token'], text=True).strip()
SID = '1w4Crj0x0LDCfAMQJtqwJ7sBLlOv3FgKFCp8PROTeJPc'
H = {'Authorization': 'Bearer ' + T}
d = json.loads(urllib.request.urlopen(urllib.request.Request(
    'https://sheets.googleapis.com/v4/spreadsheets/%s?fields=sheets.properties' % SID, headers=H)).read())
gid = [s['properties']['sheetId'] for s in d['sheets'] if s['properties']['title']=='明細レイアウト'][0]
p = dict(format='pdf', gid=gid, portrait='true', size='A4', fitw='true', gridlines='false',
         printtitle='false', sheetnames='false', pagenumbers='false',
         top_margin='0.5', bottom_margin='0.5', left_margin='0.5', right_margin='0.5',
         r1=0, c1=0, r2=17, c2=6)
url = 'https://docs.google.com/spreadsheets/d/%s/export?%s' % (SID, urllib.parse.urlencode(p))
data = urllib.request.urlopen(urllib.request.Request(url, headers=H)).read()
out = sys.argv[1]
open(out,'wb').write(data)
print('gid=%s  bytes=%d  -> %s' % (gid, len(data), out))
