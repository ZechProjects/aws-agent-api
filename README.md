# AWS Agent API Demo (API Gateway + Lambda + CloudFront)

This project creates a production-minded demo for exposing a mock API to AI agents using:

- AWS Lambda (Node.js 20)
- API Gateway HTTP API
- CloudWatch logging with retention
- S3 + CloudFront for static machine-readable docs
- robots.txt and llms.txt hosted on CloudFront

## What You Get

1. API endpoints for AI-agent integration testing:
   - `GET /v1/health`
   - `GET /v1/agent/tools`
   - `POST /v1/agent/mock`
2. A traditional (not agent-friendly) copy of the same mock API, for comparison:
   - `GET /legacy/health`
   - `GET /legacy/ops`
   - `POST /legacy/exec`
3. Side-by-side payload samples in `docs/`:
   - `docs/agent-friendly-payload.json`
   - `docs/traditional-payload.json`
4. Static docs published through CloudFront:
   - `/robots.txt`
   - `/llms.txt`
   - `/openapi.yaml`
5. Terraform IaC with secure defaults:
   - Lambda least-privilege logging policy
   - API throttling and access logs
   - S3 private bucket with CloudFront Origin Access Control (OAC)
   - Security headers policy on CloudFront

## Project Layout

```text
docs/                 # Side-by-side agent-friendly vs traditional payload samples
infra/terraform/      # Infrastructure as code
src/lambda/           # Lambda handler code
static/               # robots.txt, llms.txt, openapi.yaml hosted on CloudFront
```

## Prerequisites

- Terraform >= 1.6
- AWS CLI configured with deploy permissions
- An AWS account

## Deploy

From the project root:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

After apply, Terraform outputs:

- `api_base_url`
- `health_url`
- `mock_url`
- `legacy_mock_url`
- `cloudfront_domain_name`
- `robots_txt_url`
- `llms_txt_url`

## Quick Test

Use the `mock_url` output:

```bash
curl -X POST "<mock_url>" \
  -H "content-type: application/json" \
  -d '{"prompt":"Summarize API best practices for agents"}'
```

Health check:

```bash
curl "<health_url>"
```

Tool catalog:

```bash
curl "<api_base_url>/v1/agent/tools"
```

Traditional (not agent-friendly) copy of the same mock completion:

```bash
curl -X POST "<legacy_mock_url>" \
  -H "content-type: application/json" \
  -H "x-session-id: 00000000-0000-0000-0000-000000000000" \
  -d '{"d":{"ActionCode":1003,"ParamList":[{"Key":"P1","Val":"Summarize API best practices for agents"}]}}'
```

## Best-Practice Notes Included

- Explicit API routes instead of catch-all routing.
- Structured error payloads for agent-friendly handling.
- A traditional RPC copy of the same mock so payload shapes can be compared in `docs/`.
- Request ID propagation with `x-request-id`.
- Reasonable default throttling to protect backend services.
- CloudWatch access logs for API observability.
- Private S3 origin with CloudFront OAC instead of public bucket hosting.
- Machine-readable discovery assets (`llms.txt`, `openapi.yaml`) served from a fast edge cache.

## Customization

- Edit Lambda behavior: `src/lambda/index.js`
- Tune throttling, CORS, retention: `infra/terraform/variables.tf`
- Update agent docs: `static/llms.txt` and `static/openapi.yaml`
- Compare payload shapes: `docs/agent-friendly-payload.json` and `docs/traditional-payload.json`

## Cleanup

```bash
cd infra/terraform
terraform destroy
```
