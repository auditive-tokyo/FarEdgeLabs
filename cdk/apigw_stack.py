from aws_cdk import (
    aws_s3 as s3,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_apigateway as apigw,
    aws_iam as iam,
    aws_lambda as aws_lambda,
    Stack,
    RemovalPolicy,
    CfnOutput,
)
from constructs import Construct

CORS_ALLOWED_ORIGINS = [
    "https://auditive-tokyo.github.io",
    "http://localhost:5173",
]

ALLOW_ORIGIN_HEADER = "method.response.header.Access-Control-Allow-Origin"

METHOD_RESPONSES = [
    apigw.MethodResponse(
        status_code="200",
        response_parameters={
            ALLOW_ORIGIN_HEADER: True,
            "method.response.header.Content-Type": True,
            "method.response.header.Cache-Control": True,
        },
    ),
    apigw.MethodResponse(
        status_code="404",
        response_parameters={
            ALLOW_ORIGIN_HEADER: True,
        },
    ),
]


class ApiGwStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        contact_form_fn: aws_lambda.IFunction,
        content_crud_fn: aws_lambda.IFunction,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── DynamoDB Tables ──────────────────────────────────────────────────
        content_table = dynamodb.Table(
            self, "ContentTable",
            table_name="faredgelabs-content-table",
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            partition_key=dynamodb.Attribute(
                name="id",
                type=dynamodb.AttributeType.STRING,
            ),
            removal_policy=RemovalPolicy.RETAIN,
        )
        content_table.node.default_child.override_logical_id("ContentTable")  # type: ignore[union-attr]

        site_config_table = dynamodb.Table(
            self, "SiteConfigTable",
            table_name="faredgelabs-site-config",
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            partition_key=dynamodb.Attribute(
                name="id",
                type=dynamodb.AttributeType.STRING,
            ),
            removal_policy=RemovalPolicy.RETAIN,
        )
        site_config_table.node.default_child.override_logical_id("SiteConfigTable")  # type: ignore[union-attr]

        # ── S3 Bucket ────────────────────────────────────────────────────────
        content_bucket = s3.Bucket(
            self, "ContentBucket",
            bucket_name="faredgelabs-content-md",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.RETAIN,
            versioned=False,  # NOSONAR - versioning not needed; content is managed via DynamoDB + S3 write-through
            enforce_ssl=True,
            cors=[
                s3.CorsRule(
                    allowed_methods=[s3.HttpMethods.GET],
                    allowed_origins=CORS_ALLOWED_ORIGINS,
                    allowed_headers=["*"],
                )
            ],
        )

        # ── Cognito User Pool ────────────────────────────────────────────────
        user_pool = cognito.UserPool(
            self, "AdminUserPool",
            user_pool_name="faredgelabs-admin-pool",
            self_sign_up_enabled=False,
            removal_policy=RemovalPolicy.RETAIN,
        )

        user_pool_client = user_pool.add_client(
            "AdminUserPoolClient",
            user_pool_client_name="faredgelabs-admin-client",
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
            ),
        )

        # ── API Gateway REST API ─────────────────────────────────────────────
        api = apigw.RestApi(
            self, "FarEdgeLabsApi",
            rest_api_name="faredgelabs-api",
            deploy_options=apigw.StageOptions(stage_name="prod"),
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=CORS_ALLOWED_ORIGINS,
                allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        # ── API GW execution role (S3 read) ──────────────────────────────────
        api_gw_role = iam.Role(
            self, "ApiGwS3Role",
            assumed_by=iam.ServicePrincipal("apigateway.amazonaws.com"),
        )
        content_bucket.grant_read(api_gw_role)

        # ── Cognito Authorizer ───────────────────────────────────────────────
        authorizer = apigw.CognitoUserPoolsAuthorizer(
            self, "CognitoAuthorizer",
            cognito_user_pools=[user_pool],
        )

        # ── Lambda integrations ──────────────────────────────────────────────
        contact_integration = apigw.LambdaIntegration(contact_form_fn)
        crud_integration = apigw.LambdaIntegration(content_crud_fn)

        # ── Helper: build S3 GET integration ─────────────────────────────────
        def s3_get_integration(
            s3_path: str,
            request_parameters: dict | None = None,
        ) -> apigw.AwsIntegration:
            return apigw.AwsIntegration(
                service="s3",
                integration_http_method="GET",
                path=f"faredgelabs-content-md/{s3_path}",
                options=apigw.IntegrationOptions(
                    credentials_role=api_gw_role,
                    request_parameters=request_parameters or {},
                    integration_responses=[
                        apigw.IntegrationResponse(
                            status_code="200",
                            response_parameters={
                                ALLOW_ORIGIN_HEADER: "'*'",
                                "method.response.header.Content-Type": "integration.response.header.Content-Type",
                                "method.response.header.Cache-Control": "'public, max-age=300'",
                            },
                        ),
                        apigw.IntegrationResponse(
                            status_code="404",
                            selection_pattern="404",
                            response_parameters={
                                ALLOW_ORIGIN_HEADER: "'*'",
                            },
                        ),
                    ],
                ),
            )

        # ── /contents ─── GET → S3 contents-list.json ────────────────────────
        contents_resource = api.root.add_resource("contents")
        contents_resource.add_method(
            "GET",
            s3_get_integration("contents-list.json"),
            method_responses=METHOD_RESPONSES,
        )

        # ── /contents/{id} ─── GET → S3 contents/{id}.md ─────────────────────
        content_id_resource = contents_resource.add_resource("{id}")
        content_id_resource.add_method(
            "GET",
            s3_get_integration(
                "contents/{id}.md",
                request_parameters={
                    "integration.request.path.id": "method.request.path.id",
                },
            ),
            request_parameters={"method.request.path.id": True},
            method_responses=METHOD_RESPONSES,
        )

        # ── /site-config ─── GET → S3 site-config.json ───────────────────────
        site_config_resource = api.root.add_resource("site-config")
        site_config_resource.add_method(
            "GET",
            s3_get_integration("site-config.json"),
            method_responses=METHOD_RESPONSES,
        )

        # ── /contact ─── POST → Lambda contact_form ───────────────────────────
        contact_resource = api.root.add_resource("contact")
        contact_resource.add_method("POST", contact_integration)

        # ── /admin ───────────────────────────────────────────────────────────
        admin_resource = api.root.add_resource("admin")

        # /admin/contents ─── GET, POST → Lambda content_crud
        admin_contents = admin_resource.add_resource("contents")
        for method in ("GET", "POST"):
            admin_contents.add_method(
                method,
                crud_integration,
                authorizer=authorizer,
                authorization_type=apigw.AuthorizationType.COGNITO,
            )

        # /admin/contents/{id} ─── GET, PUT, DELETE → Lambda content_crud
        admin_content_id = admin_contents.add_resource("{id}")
        for method in ("GET", "PUT", "DELETE"):
            admin_content_id.add_method(
                method,
                crud_integration,
                authorizer=authorizer,
                authorization_type=apigw.AuthorizationType.COGNITO,
            )

        # /admin/site-config ─── PUT → Lambda content_crud
        admin_site_config = admin_resource.add_resource("site-config")
        admin_site_config.add_method(
            "PUT",
            crud_integration,
            authorizer=authorizer,
            authorization_type=apigw.AuthorizationType.COGNITO,
        )

        # ── Outputs ───────────────────────────────────────────────────────────
        CfnOutput(
            self, "ApiEndpoint",
            value=api.url,
            description="API Gateway endpoint URL",
            export_name="FarEdgeLabsApiEndpoint",
        )
        CfnOutput(
            self, "UserPoolId",
            value=user_pool.user_pool_id,
            description="Cognito User Pool ID",
            export_name="FarEdgeLabsUserPoolId",
        )
        CfnOutput(
            self, "UserPoolClientId",
            value=user_pool_client.user_pool_client_id,
            description="Cognito User Pool Client ID",
            export_name="FarEdgeLabsUserPoolClientId",
        )
