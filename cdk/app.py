#!/usr/bin/env python3
import os

import aws_cdk as cdk

from lambda_stack import LambdaStack
from apigw_stack import ApiGwStack

app = cdk.App()

env = cdk.Environment(
    account=os.getenv("CDK_DEFAULT_ACCOUNT"),
    region=os.getenv("CDK_DEFAULT_REGION", "ap-northeast-1"),
)

lambda_stack = LambdaStack(app, "faredgelabs-lambda", env=env)

apigw_stack = ApiGwStack(
    app,
    "faredgelabs-apigw",
    contact_form_fn=lambda_stack.contact_form_fn,
    content_crud_fn=lambda_stack.content_crud_fn,
    env=env,
)
apigw_stack.add_dependency(lambda_stack)

app.synth()
