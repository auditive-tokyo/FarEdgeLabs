# -*- coding: utf-8 -*-
"""給与明細のスプレッドシートを丸ごと組み立てる。手作業のレイアウトを避けるため。"""
import json, subprocess, urllib.request, urllib.error, sys

TOKEN = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True).strip()

def api(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={'Authorization': 'Bearer ' + TOKEN,
                                          'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        sys.exit('HTTP %s\n%s' % (e.code, e.read().decode()[:900]))

SHEETS = ['設定', '単価マスタ', '明細レイアウト', '発行ログ']

# 1) 保存先フォルダ
folder = api('POST', 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
             {'name': '給与明細', 'mimeType': 'application/vnd.google-apps.folder'})

# 2) スプレッドシート本体
ss = api('POST', 'https://sheets.googleapis.com/v4/spreadsheets', {
    'properties': {'title': '給与明細 — FarEdge Labs', 'locale': 'ja_JP', 'timeZone': 'Asia/Tokyo'},
    'sheets': [
        {'properties': {'title': '設定',       'gridProperties': {'rowCount': 12,  'columnCount': 2}}},
        {'properties': {'title': '単価マスタ',   'gridProperties': {'rowCount': 60,  'columnCount': 6}}},
        {'properties': {'title': '明細レイアウト', 'gridProperties': {'rowCount': 18,  'columnCount': 6}}},
        {'properties': {'title': '発行ログ',     'gridProperties': {'rowCount': 300, 'columnCount': 6}}},
    ],
})
SID = ss['spreadsheetId']
gid = {s['properties']['title']: s['properties']['sheetId'] for s in ss['sheets']}

# 3) スプレッドシートもフォルダへ移す
api('PATCH', 'https://www.googleapis.com/drive/v3/files/%s?addParents=%s&removeParents=root&fields=id'
    % (SID, folder['id']))

L = gid['明細レイアウト']

def rng(r1, c1, r2, c2, sid=None):
    """1始まり・終端含むで書いて、API の0始まり・終端排他に直す"""
    return {'sheetId': L if sid is None else sid,
            'startRowIndex': r1 - 1, 'endRowIndex': r2,
            'startColumnIndex': c1 - 1, 'endColumnIndex': c2}

def merge(r1, c1, r2, c2):
    return {'mergeCells': {'range': rng(r1, c1, r2, c2), 'mergeType': 'MERGE_ALL'}}

def fmt(r1, c1, r2, c2, cell, fields):
    # fields は 'userEnteredFormat.numberFormat' のようなドット記法をカンマで並べる。
    # 'userEnteredFormat(a,b)' の括弧記法だと numberFormat が黙って無視され、
    # エラーも出ないまま既定書式のまま残る（実際に一度これで桁区切りが消えた）。
    mask = ','.join('userEnteredFormat.' + f.strip() for f in fields.split(','))
    return {'repeatCell': {'range': rng(r1, c1, r2, c2), 'cell': {'userEnteredFormat': cell},
                           'fields': mask}}

LINE = {'style': 'SOLID', 'width': 1, 'color': {'red': .45, 'green': .45, 'blue': .45}}
THICK = {'style': 'SOLID_MEDIUM', 'width': 2, 'color': {'red': .2, 'green': .2, 'blue': .2}}

req = []

# 列幅と行高
for col, px in enumerate([96, 104, 116, 104, 116, 116], start=1):
    req.append({'updateDimensionProperties': {
        'range': {'sheetId': L, 'dimension': 'COLUMNS', 'startIndex': col - 1, 'endIndex': col},
        'properties': {'pixelSize': px}, 'fields': 'pixelSize'}})
for row, px in [(1, 46), (3, 14), (5, 10), (7, 18), (14, 14), (16, 14)]:
    req.append({'updateDimensionProperties': {
        'range': {'sheetId': L, 'dimension': 'ROWS', 'startIndex': row - 1, 'endIndex': row},
        'properties': {'pixelSize': px}, 'fields': 'pixelSize'}})

# 結合
for m in [(1,1,1,6), (2,2,2,3), (2,5,2,6), (4,2,4,4), (6,2,6,4),
          (8,1,8,3), (8,4,8,6),
          (9,1,9,2), (10,1,10,2), (11,1,11,2), (12,1,12,2), (13,1,13,2),
          (9,4,9,5), (10,4,10,5), (11,4,11,5), (12,4,12,5), (13,4,13,5),
          (15,4,15,5), (17,1,17,6)]:
    req.append(merge(*m))

# タイトル
req.append(fmt(1,1,1,6, {'horizontalAlignment': 'CENTER', 'verticalAlignment': 'MIDDLE',
                         'textFormat': {'fontSize': 18, 'bold': True}},
               'horizontalAlignment,verticalAlignment,textFormat'))
# 対象年月（左）と支給日（右）
req.append(fmt(2,2,2,3, {'horizontalAlignment': 'LEFT',  'textFormat': {'fontSize': 11}},
               'horizontalAlignment,textFormat'))
req.append(fmt(2,5,2,6, {'horizontalAlignment': 'RIGHT', 'textFormat': {'fontSize': 11}},
               'horizontalAlignment,textFormat'))
# 支払者・氏名のラベル
req.append(fmt(4,1,6,1, {'horizontalAlignment': 'LEFT', 'textFormat': {'fontSize': 10,
              'foregroundColor': {'red': .4, 'green': .4, 'blue': .4}}},
               'horizontalAlignment,textFormat'))
req.append(fmt(4,2,4,4, {'textFormat': {'fontSize': 11}}, 'textFormat'))
req.append(fmt(6,2,6,4, {'textFormat': {'fontSize': 13, 'bold': True}}, 'textFormat'))
# 支給／控除の見出し帯
req.append(fmt(8,1,8,6, {'horizontalAlignment': 'CENTER', 'verticalAlignment': 'MIDDLE',
                         'backgroundColor': {'red': .92, 'green': .92, 'blue': .92},
                         'textFormat': {'bold': True, 'fontSize': 11}},
               'horizontalAlignment,verticalAlignment,backgroundColor,textFormat'))
# 明細行のラベルと金額
req.append(fmt(9,1,13,1, {'horizontalAlignment': 'LEFT'}, 'horizontalAlignment'))
req.append(fmt(9,4,13,4, {'horizontalAlignment': 'LEFT'}, 'horizontalAlignment'))
for c in (3, 6):
    req.append(fmt(9,c,13,c, {'horizontalAlignment': 'RIGHT',
                              'numberFormat': {'type': 'NUMBER', 'pattern': '#,##0'}},
                   'horizontalAlignment,numberFormat'))
# 合計行
req.append(fmt(13,1,13,6, {'textFormat': {'bold': True}}, 'textFormat'))
# 差引支給額
req.append(fmt(15,4,15,5, {'horizontalAlignment': 'CENTER', 'verticalAlignment': 'MIDDLE',
                           'backgroundColor': {'red': .95, 'green': .95, 'blue': .95},
                           'textFormat': {'bold': True, 'fontSize': 12}},
               'horizontalAlignment,verticalAlignment,backgroundColor,textFormat'))
req.append(fmt(15,6,15,6, {'horizontalAlignment': 'RIGHT', 'verticalAlignment': 'MIDDLE',
                           'textFormat': {'bold': True, 'fontSize': 14},
                           'numberFormat': {'type': 'NUMBER', 'pattern': '#,##0'}},
               'horizontalAlignment,verticalAlignment,textFormat,numberFormat'))
req.append({'updateDimensionProperties': {
    'range': {'sheetId': L, 'dimension': 'ROWS', 'startIndex': 14, 'endIndex': 15},
    'properties': {'pixelSize': 34}, 'fields': 'pixelSize'}})
# 注記
req.append(fmt(17,1,17,6, {'horizontalAlignment': 'LEFT',
                           'textFormat': {'fontSize': 9,
                           'foregroundColor': {'red': .5, 'green': .5, 'blue': .5}}},
               'horizontalAlignment,textFormat'))
# 罫線
req.append({'updateBorders': dict(range=rng(8,1,13,6), top=THICK, bottom=THICK, left=THICK,
                                  right=THICK, innerHorizontal=LINE, innerVertical=LINE)})
req.append({'updateBorders': dict(range=rng(15,4,15,6), top=THICK, bottom=THICK, left=THICK, right=THICK)})
# 罫線を消す・シートを整える
req.append({'updateSheetProperties': {
    'properties': {'sheetId': L, 'gridProperties': {'hideGridlines': True}},
    'fields': 'gridProperties.hideGridlines'}})
# 単価マスタ・発行ログのヘッダ書式
for name in ('単価マスタ', '発行ログ'):
    req.append({'repeatCell': {
        'range': {'sheetId': gid[name], 'startRowIndex': 0, 'endRowIndex': 1},
        'cell': {'userEnteredFormat': {'backgroundColor': {'red': .92, 'green': .92, 'blue': .92},
                                       'textFormat': {'bold': True}}},
        'fields': 'userEnteredFormat(backgroundColor,textFormat)'}})
    req.append({'updateSheetProperties': {
        'properties': {'sheetId': gid[name], 'gridProperties': {'frozenRowCount': 1}},
        'fields': 'gridProperties.frozenRowCount'}})
# 単価マスタの金額列
req.append({'repeatCell': {
    'range': {'sheetId': gid['単価マスタ'], 'startRowIndex': 1, 'startColumnIndex': 1, 'endColumnIndex': 6},
    'cell': {'userEnteredFormat': {'numberFormat': {'type': 'NUMBER', 'pattern': '#,##0'}}},
    'fields': 'userEnteredFormat.numberFormat'}})
# 適用開始列は文字列で扱う（2026-04 が日付に化けるのを防ぐ）
req.append({'repeatCell': {
    'range': {'sheetId': gid['単価マスタ'], 'startRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 1},
    'cell': {'userEnteredFormat': {'numberFormat': {'type': 'TEXT'}}},
    'fields': 'userEnteredFormat.numberFormat'}})
req.append({'updateCells': {
    'range': {'sheetId': gid['単価マスタ'], 'startRowIndex': 0, 'endRowIndex': 1,
              'startColumnIndex': 0, 'endColumnIndex': 1},
    'rows': [{'values': [{'note': 'YYYY-MM で入力。この年月「以降」に適用される。'
                                  '改定時は上書きせず行を追加すること — 過去の月を同じ内容で再発行できなくなる。'}]}],
    'fields': 'note'}})
# 設定シートの列幅
for col, px in [(1, 150), (2, 420)]:
    req.append({'updateDimensionProperties': {
        'range': {'sheetId': gid['設定'], 'dimension': 'COLUMNS', 'startIndex': col-1, 'endIndex': col},
        'properties': {'pixelSize': px}, 'fields': 'pixelSize'}})

api('POST', 'https://sheets.googleapis.com/v4/spreadsheets/%s:batchUpdate' % SID, {'requests': req})

# 4) 中身
api('POST', 'https://sheets.googleapis.com/v4/spreadsheets/%s/values:batchUpdate' % SID, {
    'valueInputOption': 'RAW',
    'data': [
        {'range': '設定!A1:B4', 'values': [
            ['会社名', ''], ['氏名', ''],
            ['保存先フォルダID', folder['id']],
            ['（会社名と氏名は必須。空のままだと発行時にエラーになります）', '']]},
        {'range': '単価マスタ!A1:F1', 'values': [
            ['適用開始', '役員報酬', '健康保険料', '介護保険料', '厚生年金保険料', '源泉所得税']]},
        {'range': '発行ログ!A1:F1', 'values': [
            ['対象年月', '支給日', '差引支給額', '発行日時', 'ファイル名', 'URL']]},
        {'range': '明細レイアウト!A1:F17', 'values': [
            ['給 与 明 細 書', '', '', '', '', ''],
            ['', '', '', '', '', ''],
            ['', '', '', '', '', ''],
            ['支払者', '', '', '', '', ''],
            ['', '', '', '', '', ''],
            ['氏名', '', '', '', '', ''],
            ['', '', '', '', '', ''],
            ['支　給', '', '', '控　除', '', ''],
            ['役員報酬', '', '', '健康保険料', '', ''],
            ['', '', '', '介護保険料', '', ''],
            ['', '', '', '厚生年金保険料', '', ''],
            ['', '', '', '源泉所得税', '', ''],
            ['支給合計', '', '', '控除合計', '', ''],
            ['', '', '', '', '', ''],
            ['', '', '', '差引支給額', '', ''],
            ['', '', '', '', '', ''],
            ['住民税は普通徴収のため控除欄にありません。雇用保険・労災保険は役員のため対象外です。', '', '', '', '', '']]},
    ]})

print('SPREADSHEET_ID', SID)
print('SHEET_URL     https://docs.google.com/spreadsheets/d/%s/edit' % SID)
print('FOLDER_ID     ' + folder['id'])
print('FOLDER_URL    ' + folder['webViewLink'])
