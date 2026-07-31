import os
import json
import uuid
import boto3
from botocore.config import Config
from datetime import datetime, timezone

_BOTO_CONFIG = Config(connect_timeout=5, read_timeout=10)

dynamodb = boto3.resource('dynamodb', config=_BOTO_CONFIG)
s3_client = boto3.client('s3', config=_BOTO_CONFIG)
ACCOUNT_ID = boto3.client('sts', config=_BOTO_CONFIG).get_caller_identity()['Account']

CONTENT_TABLE = os.environ.get('CONTENT_TABLE', 'faredgelabs-content-table')
SITE_CONFIG_TABLE = os.environ.get('SITE_CONFIG_TABLE', 'faredgelabs-site-config')
S3_BUCKET = os.environ.get('CONTENT_BUCKET', 'faredgelabs-content-md')
CONTENT_TYPE_JSON = 'application/json'

ALLOWED_ORIGINS = [
    'https://auditive-tokyo.github.io',
    'http://localhost:5173',
]
_DEFAULT_ORIGIN = ALLOWED_ORIGINS[0]
_request_origin = _DEFAULT_ORIGIN


def _get_allowed_origin(event):
    headers = event.get('headers') or {}
    origin = headers.get('origin') or headers.get('Origin', '')
    return origin if origin in ALLOWED_ORIGINS else _DEFAULT_ORIGIN


def make_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': _request_origin,
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Content-Type': CONTENT_TYPE_JSON,
        },
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }


def regenerate_contents_list():
    """Scan DynamoDB and write the published contents index to S3."""
    table = dynamodb.Table(CONTENT_TABLE)
    result = table.scan()
    items = result.get('Items', [])
    published = [
        {k: v for k, v in item.items() if k != 'content'}
        for item in items
        if item.get('status') == 'PUBLISHED'
    ]
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key='contents-list.json',
        Body=json.dumps(published, ensure_ascii=False, default=str),
        ContentType=CONTENT_TYPE_JSON,
        ExpectedBucketOwner=ACCOUNT_ID,
    )


def sync_content_to_s3(item):
    """Write content markdown to S3 when PUBLISHED, delete when DRAFT."""
    content_id = item['id']
    if item.get('status') == 'PUBLISHED':
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=f'contents/{content_id}.md',
            Body=item.get('content', ''),
            ContentType='text/markdown',
            ExpectedBucketOwner=ACCOUNT_ID,
        )
    else:
        try:
            s3_client.delete_object(Bucket=S3_BUCKET, Key=f'contents/{content_id}.md', ExpectedBucketOwner=ACCOUNT_ID)
        except Exception as exc:
            print(f"S3 delete skipped: {exc}")


def handle_list_contents():
    table = dynamodb.Table(CONTENT_TABLE)
    result = table.scan()
    return make_response(200, result.get('Items', []))


def handle_get_content(content_id):
    table = dynamodb.Table(CONTENT_TABLE)
    result = table.get_item(Key={'id': content_id})
    item = result.get('Item')
    if not item:
        return make_response(404, {'message': 'Content not found'})
    return make_response(200, item)


def handle_create_content(body):
    table = dynamodb.Table(CONTENT_TABLE)
    now = datetime.now(timezone.utc).isoformat()
    item = {
        'id': body.get('id') or str(uuid.uuid4()),
        'title': body.get('title', ''),
        'content': body.get('content', ''),
        'status': body.get('status', 'DRAFT'),
        'createdAt': now,
        'updatedAt': now,
    }
    table.put_item(Item=item)
    sync_content_to_s3(item)
    regenerate_contents_list()
    return make_response(201, item)


def handle_update_content(content_id, body):
    table = dynamodb.Table(CONTENT_TABLE)
    now = datetime.now(timezone.utc).isoformat()
    result = table.update_item(
        Key={'id': content_id},
        UpdateExpression='SET #title = :title, #content = :content, #status = :status, #updatedAt = :updatedAt',
        ExpressionAttributeNames={
            '#title': 'title',
            '#content': 'content',
            '#status': 'status',
            '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues={
            ':title': body.get('title', ''),
            ':content': body.get('content', ''),
            ':status': body.get('status', 'DRAFT'),
            ':updatedAt': now,
        },
        ReturnValues='ALL_NEW',
    )
    item = result.get('Attributes', {})
    sync_content_to_s3(item)
    regenerate_contents_list()
    return make_response(200, item)


def handle_delete_content(content_id):
    table = dynamodb.Table(CONTENT_TABLE)
    table.delete_item(Key={'id': content_id})
    try:
        s3_client.delete_object(Bucket=S3_BUCKET, Key=f'contents/{content_id}.md', ExpectedBucketOwner=ACCOUNT_ID)
    except Exception as exc:
        print(f"S3 delete skipped: {exc}")
    regenerate_contents_list()
    return make_response(200, {'message': 'Deleted successfully'})


def handle_update_site_config(body):
    table = dynamodb.Table(SITE_CONFIG_TABLE)
    config_id = body.get('id', 'default')

    update_parts = []
    expr_names = {}
    expr_values = {}

    if 'defaultPageId' in body:
        update_parts.append('#defaultPageId = :defaultPageId')
        expr_names['#defaultPageId'] = 'defaultPageId'
        expr_values[':defaultPageId'] = body['defaultPageId']

    if 'menuOrder' in body:
        update_parts.append('#menuOrder = :menuOrder')
        expr_names['#menuOrder'] = 'menuOrder'
        expr_values[':menuOrder'] = body['menuOrder']

    if not update_parts:
        return make_response(400, {'message': 'No fields to update'})

    result = table.update_item(
        Key={'id': config_id},
        UpdateExpression='SET ' + ', '.join(update_parts),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
        ReturnValues='ALL_NEW',
    )
    item = result.get('Attributes', {})

    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key='site-config.json',
        Body=json.dumps(item, ensure_ascii=False, default=str),
        ContentType=CONTENT_TYPE_JSON,
        ExpectedBucketOwner=ACCOUNT_ID,
    )
    return make_response(200, item)


def _route_content_item(http_method, content_id, body):
    if http_method == 'GET':
        return handle_get_content(content_id)
    if http_method == 'PUT':
        return handle_update_content(content_id, body)
    if http_method == 'DELETE':
        return handle_delete_content(content_id)
    return None


def lambda_handler(event, context):
    global _request_origin
    _request_origin = _get_allowed_origin(event)

    print("Received event:", json.dumps(event))

    http_method = event.get('httpMethod', '')
    resource = event.get('resource', '')
    path_params = event.get('pathParameters') or {}

    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        return make_response(400, {'message': 'Invalid JSON body'})

    if resource == '/admin/contents' and http_method == 'GET':
        return handle_list_contents()
    if resource == '/admin/contents' and http_method == 'POST':
        return handle_create_content(body)

    if resource == '/admin/contents/{id}':
        result = _route_content_item(http_method, path_params.get('id', ''), body)
        if result:
            return result

    if resource == '/admin/site-config' and http_method == 'PUT':
        return handle_update_site_config(body)

    return make_response(404, {'message': 'Not Found'})
