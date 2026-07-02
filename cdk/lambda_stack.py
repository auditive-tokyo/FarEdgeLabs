from aws_cdk import (
    aws_dynamodb as dynamodb,
    aws_lambda as aws_lambda,
    aws_logs as logs,
    aws_s3 as s3,
    Stack,
    RemovalPolicy,
    Duration,
    CfnOutput,
    CfnParameter,
)
from constructs import Construct


class LambdaStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Parameters
        sender_email = CfnParameter(
            self, "SenderEmail",
            type="String",
            description="Sender email address for contact form",
        )
        receiver_email = CfnParameter(
            self, "ReceiverEmail",
            type="String",
            description="Receiver email address for contact form",
        )
        zoho_app_password = CfnParameter(
            self, "ZohoAppPassword",
            type="String",
            description="Zoho app password for email",
            no_echo=True,
        )

        # Rate Limit DynamoDB Table
        rate_limit_table = dynamodb.Table(
            self, "RateLimitTable",
            table_name="auditive-rate-limit",
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            partition_key=dynamodb.Attribute(
                name="ip",
                type=dynamodb.AttributeType.STRING,
            ),
            time_to_live_attribute="ttl",
            removal_policy=RemovalPolicy.RETAIN,
        )
        # Preserve logical ID from existing SAM stack to avoid resource replacement
        rate_limit_table.node.default_child.override_logical_id("RateLimitTable")  # type: ignore[union-attr]

        # Contact Submissions DynamoDB Table
        contact_table = dynamodb.Table(
            self, "ContactTable",
            table_name="auditive-contact-submissions",
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            partition_key=dynamodb.Attribute(
                name="id",
                type=dynamodb.AttributeType.STRING,
            ),
            removal_policy=RemovalPolicy.RETAIN,
        )

        # CloudWatch Log Group
        log_group = logs.LogGroup(
            self, "ContactFormLogGroup",
            log_group_name="/aws/lambda/auditive-contact-form",
            retention=logs.RetentionDays.ONE_MONTH,
            removal_policy=RemovalPolicy.RETAIN,
        )
        log_group.node.default_child.override_logical_id("ContactFormLogGroup")  # type: ignore[union-attr]

        # Lambda Function
        fn = aws_lambda.Function(
            self, "ContactFormFunction",
            function_name="auditive-contact-form",
            runtime=aws_lambda.Runtime.PYTHON_3_13,
            handler="app.lambda_handler",
            code=aws_lambda.Code.from_asset("../lambda_functions/contact_form"),
            timeout=Duration.seconds(30),
            log_group=log_group,
            environment={
                "SENDER_EMAIL": sender_email.value_as_string,
                "RECEIVER_EMAIL": receiver_email.value_as_string,
                "APP_PASSWORD": zoho_app_password.value_as_string,
                "RATE_LIMIT_TABLE": rate_limit_table.table_name,
                "CONTACT_TABLE": contact_table.table_name,
            },
        )
        fn.node.default_child.override_logical_id("ContactFormFunction")  # type: ignore[union-attr]

        # Grant Lambda read/write access to DynamoDB
        rate_limit_table.grant_read_write_data(fn)
        contact_table.grant_read_write_data(fn)

        # Output Lambda ARN
        CfnOutput(
            self, "ContactFormFunctionArn",
            value=fn.function_arn,
            description="Contact Form Lambda Function ARN",
            export_name="AuditiveContactFormFunctionArn",
        )

        # Expose for cross-stack reference
        self.contact_form_fn = fn

        # ── Content CRUD Lambda ──────────────────────────────────────────────
        content_crud_fn = aws_lambda.Function(
            self, "ContentCrudFunction",
            function_name="auditive-content-crud",
            runtime=aws_lambda.Runtime.PYTHON_3_13,
            handler="app.lambda_handler",
            code=aws_lambda.Code.from_asset("../lambda_functions/content_crud"),
            timeout=Duration.seconds(30),
            environment={
                "CONTENT_TABLE": "auditive-content-table",
                "SITE_CONFIG_TABLE": "auditive-site-config",
                "CONTENT_BUCKET": "auditive-content-md",
            },
        )

        # Grant DynamoDB access (tables are defined in ApiGwStack)
        content_table_ref = dynamodb.Table.from_table_name(
            self, "ContentTableRef", "auditive-content-table"
        )
        site_config_table_ref = dynamodb.Table.from_table_name(
            self, "SiteConfigTableRef", "auditive-site-config"
        )
        content_table_ref.grant_read_write_data(content_crud_fn)
        site_config_table_ref.grant_read_write_data(content_crud_fn)

        # Grant S3 access (bucket is defined in ApiGwStack)
        content_bucket_ref = s3.Bucket.from_bucket_name(
            self, "ContentBucketRef", "auditive-content-md"
        )
        content_bucket_ref.grant_read_write(content_crud_fn)

        CfnOutput(
            self, "ContentCrudFunctionArn",
            value=content_crud_fn.function_arn,
            description="Content CRUD Lambda Function ARN",
            export_name="AuditiveContentCrudFunctionArn",
        )

        self.content_crud_fn = content_crud_fn
