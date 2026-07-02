import os
import json
import time
import uuid
import smtplib
import boto3
from botocore.config import Config
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Lambda向けにタイムアウトを設定
boto3_config = Config(
    connect_timeout=5,    # 接続タイムアウト: 5秒
    read_timeout=30,      # 読み取りタイムアウト: 30秒
    retries={'max_attempts': 3}  # リトライ回数
)
dynamodb = boto3.resource('dynamodb', config=boto3_config)

RATE_LIMIT = 3  # 1分間に3回まで
RATE_LIMIT_WINDOW = 60  # 60秒

ALLOWED_ORIGINS = [
    'https://auditive-tokyo.github.io',
    'https://auditive.tokyo',
    'http://localhost:5173',
]
_DEFAULT_ORIGIN = ALLOWED_ORIGINS[0]
_request_origin = _DEFAULT_ORIGIN


def _get_allowed_origin(event):
    headers = event.get('headers') or {}
    origin = headers.get('origin') or headers.get('Origin', '')
    return origin if origin in ALLOWED_ORIGINS else _DEFAULT_ORIGIN


CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': _DEFAULT_ORIGIN,
}


def _cors_headers():
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': _request_origin,
    }

def check_rate_limit(ip):
    """IPごとのレートリミットをチェック"""
    table_name = os.environ.get('RATE_LIMIT_TABLE')
    if not table_name:
        return True  # テーブル未設定時はスキップ
    
    table = dynamodb.Table(table_name)
    now = int(time.time())
    ttl = now + RATE_LIMIT_WINDOW
    
    try:
        response = table.update_item(
            Key={'ip': ip},
            UpdateExpression='SET #count = if_not_exists(#count, :zero) + :inc, #ttl = :ttl',
            ExpressionAttributeNames={'#count': 'count', '#ttl': 'ttl'},
            ExpressionAttributeValues={':zero': 0, ':inc': 1, ':ttl': ttl},
            ReturnValues='ALL_NEW'
        )
        count = response['Attributes']['count']
        return count <= RATE_LIMIT
    except Exception as e:
        print(f"Rate limit check error: {e}")
        return True  # エラー時は許可

def save_contact_submission(name, email, message, ip):
    """Save contact form submission to DynamoDB for record keeping."""
    table_name = os.environ.get('CONTACT_TABLE')
    if not table_name:
        return
    table = dynamodb.Table(table_name)
    try:
        table.put_item(Item={
            'id': str(uuid.uuid4()),
            'name': name,
            'email': email,
            'message': message,
            'ip': ip,
            'submittedAt': int(time.time()),
        })
    except Exception as e:
        print(f"Failed to save contact submission: {e}")


def lambda_handler(event, context):
    global _request_origin
    _request_origin = _get_allowed_origin(event)

    print("Received event:", json.dumps(event))

    # IPアドレス取得（API Gateway形式）
    ip = 'unknown'
    try:
        ip = event['requestContext']['identity']['sourceIp'] or 'unknown'
    except (KeyError, TypeError):
        pass

    print(f"Client IP: {ip}")

    # レートリミットチェック
    if not check_rate_limit(ip):
        return {
            'statusCode': 429,
            'headers': _cors_headers(),
            'body': json.dumps({'success': False, 'message': 'Too many requests. Please try again later.'}),
        }

    # API Gateway Lambda Proxy format
    try:
        args = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        return {
            'statusCode': 400,
            'headers': _cors_headers(),
            'body': json.dumps({'success': False, 'message': 'Invalid JSON body'}),
        }

    name = args.get('name')
    email = args.get('email')
    message = args.get('message')

    if not all([name, email, message]):
        return {
            'statusCode': 400,
            'headers': _cors_headers(),
            'body': json.dumps({'success': False, 'message': 'Missing required fields'}),
        }

    save_contact_submission(name, email, message, ip)

    sender_email = os.environ['SENDER_EMAIL']
    receiver_email = os.environ['RECEIVER_EMAIL']
    password = os.environ['APP_PASSWORD']
    smtp_server = "smtp.zoho.jp"
    smtp_port = 465

    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = receiver_email
    msg['Subject'] = f"New contact from {name}"

    body = f"Name: {name}\nEmail: {email}\n\nMessage:\n{message}"
    msg.attach(MIMEText(body, 'plain'))

    try:
        with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, msg.as_string())
        return {
            'statusCode': 200,
            'headers': _cors_headers(),
            'body': json.dumps({'success': True, 'message': 'Email sent successfully'}),
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'headers': _cors_headers(),
            'body': json.dumps({'success': False, 'message': 'Failed to send email'}),
        }