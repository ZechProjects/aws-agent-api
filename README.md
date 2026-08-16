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

You do **not** need Node.js installed locally. Terraform packages `src/lambda` into a zip during apply.

---

## Deploy from a fresh clone (step by step)

These steps assume a new machine, a GitHub clone of this repo, and an empty AWS account (or at least no existing stack with the same names). Commands below are shown for **Windows PowerShell**. macOS/Linux notes are included where the command differs.

### 1. Create or choose an AWS account

1. Sign in at [https://aws.amazon.com](https://aws.amazon.com) (or create an account).
2. Sign in to the [AWS Console](https://console.aws.amazon.com/).
3. Pick a region. This project defaults to **`us-east-1`** (N. Virginia). You can change it later in `terraform.tfvars`.

Avoid using the account root user for day-to-day deploys. Create an IAM user (or IAM Identity Center user) with programmatic access instead.

### 2. Create IAM credentials for Terraform

In the AWS Console:

1. Open **IAM** → **Users** → **Create user**.
2. Give it a name such as `terraform-deployer`.
3. Attach permissions. For a first-time demo, **AdministratorAccess** is the simplest option (this stack creates IAM roles, Lambda, API Gateway, S3, CloudFront, and CloudWatch).

   **Caveat:** `AdministratorAccess` is **not** appropriate for production. It is used here only to keep this experiment simple. In a real environment, use a least-privilege IAM policy (or IAM Identity Center permission set) scoped to the services below, and prefer short-lived credentials over long-lived access keys.

4. Open the new user → **Security credentials** → **Create access key** → choose **Command Line Interface (CLI)**.
5. Save the **Access key ID** and **Secret access key**. You will not see the secret again.

If you prefer least privilege instead of AdministratorAccess, the deployer needs permission to manage:

- IAM (roles, inline policies, `iam:PassRole`)
- Lambda
- API Gateway (HTTP APIs / `apigatewayv2`)
- CloudWatch Logs
- S3
- CloudFront

### 3. Install Git and clone this repo

If Git is not installed, install it from [https://git-scm.com/download/win](https://git-scm.com/download/win), or:

```powershell
winget install --id Git.Git -e --source winget
```

Then clone and enter the repo (replace the URL with your fork if needed):

```powershell
git clone https://github.com/<your-org-or-user>/aws-agent-api.git
cd aws-agent-api
```

### 4. Install the AWS CLI (Windows)

Install AWS CLI v2:

```powershell
winget install --id Amazon.AWSCLI -e --source winget
```

Or download the MSI from [AWS CLI install guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

Close and reopen PowerShell, then confirm:

```powershell
aws --version
```

You should see something like `aws-cli/2.x.x`.

**macOS:** `brew install awscli`  
**Linux:** see the same AWS CLI install guide.

### 5. Configure AWS credentials on Windows

From PowerShell, run:

```powershell
aws configure
```

When prompted, enter:

| Prompt | Example |
| --- | --- |
| AWS Access Key ID | `AKIA...` (from step 2) |
| AWS Secret Access Key | the secret from step 2 |
| Default region name | `us-east-1` |
| Default output format | `json` |

This writes files under your user profile:

- `C:\Users\<you>\.aws\credentials`
- `C:\Users\<you>\.aws\config`

Verify the identity Terraform will use:

```powershell
aws sts get-caller-identity
```

A successful response includes `Account`, `UserId`, and `Arn`. If this fails, Terraform will fail too.

**Optional: named profile** (useful if you have more than one AWS account):

```powershell
aws configure --profile aws-agent-api
aws sts get-caller-identity --profile aws-agent-api
```

Then, in the same PowerShell session before Terraform:

```powershell
$env:AWS_PROFILE = "aws-agent-api"
```

**Optional: environment variables instead of `aws configure`** (session-only, not written to disk):

```powershell
$env:AWS_ACCESS_KEY_ID = "AKIA..."
$env:AWS_SECRET_ACCESS_KEY = "..."
$env:AWS_DEFAULT_REGION = "us-east-1"
```

Do not commit access keys. Do not put them in `terraform.tfvars`.

### 6. Install Terraform

This project requires **Terraform 1.6 or newer**.

Windows (winget):

```powershell
winget install --id Hashicorp.Terraform -e --source winget
```

Close and reopen PowerShell, then confirm:

```powershell
terraform version
```

**macOS:** `brew install terraform`  
**Linux:** [Terraform install docs](https://developer.hashicorp.com/terraform/install)

### 7. Create your Terraform variables file

From the repo root:

```powershell
cd infra\terraform
Copy-Item terraform.tfvars.example terraform.tfvars
```

**macOS/Linux:**

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` if you want a different region, name prefix, or throttle limits. Defaults are fine for a first deploy:

```hcl
aws_region                 = "us-east-1"
project_name               = "aws-agent-api"
environment                = "dev"
cors_allowed_origins       = ["*"]
api_throttling_burst_limit = 100
api_throttling_rate_limit  = 50
log_retention_days         = 14
```

`project_name` and `environment` become the resource name prefix (for example `aws-agent-api-dev-handler`). Change `environment` if you deploy more than one copy in the same account.

### 8. Initialize, plan, and apply

Still in `infra/terraform`:

```powershell
terraform init
terraform plan
terraform apply
```

`terraform apply` will show a resource summary and ask `Do you want to perform these actions?` Type `yes`.

First apply typically takes **5–15 minutes**, mostly waiting on CloudFront. Lambda, API Gateway, and S3 are usually much faster.

When it finishes, Terraform prints outputs such as:

- `api_base_url`
- `health_url`
- `mock_url`
- `legacy_mock_url`
- `cloudfront_domain_name`
- `robots_txt_url`
- `llms_txt_url`

Re-print them later with:

```powershell
terraform output
```

### 9. Smoke-test the API

On Windows PowerShell, use `curl.exe` (not `curl`, which is an alias for `Invoke-WebRequest`).

Replace the URLs with your `terraform output` values.

Health check:

```powershell
curl.exe "<health_url>"
```

Tool catalog:

```powershell
curl.exe "<api_base_url>/v1/agent/tools"
```

Agent-friendly mock completion:

```powershell
curl.exe -X POST "<mock_url>" `
  -H "content-type: application/json" `
  -d "{\"prompt\":\"Summarize API best practices for agents\"}"
```

Traditional (not agent-friendly) copy of the same mock:

```powershell
curl.exe -X POST "<legacy_mock_url>" `
  -H "content-type: application/json" `
  -H "x-session-id: 00000000-0000-0000-0000-000000000000" `
  -d "{\"d\":{\"ActionCode\":1003,\"ParamList\":[{\"Key\":\"P1\",\"Val\":\"Summarize API best practices for agents\"}]}}"
```

Static docs (CloudFront can take a few extra minutes after apply):

```powershell
curl.exe "<robots_txt_url>"
curl.exe "<llms_txt_url>"
```

**macOS/Linux** can use `curl` as shown in the original examples:

```bash
curl -X POST "<mock_url>" \
  -H "content-type: application/json" \
  -d '{"prompt":"Summarize API best practices for agents"}'
```

---

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `No valid credential sources found` / `ExpiredToken` | Re-run `aws sts get-caller-identity`. Re-run `aws configure` or set `AWS_PROFILE`. |
| `AccessDenied` during apply | The IAM user is missing permissions (IAM, Lambda, API Gateway, S3, CloudFront, Logs). |
| `Error acquiring the state lock` | Another Terraform process is running, or a previous run crashed. Wait, or inspect leftover `.terraform` lock files locally (this repo uses local state by default). |
| CloudFront URL returns 403/404 right after apply | Wait 2–10 minutes for the distribution to deploy, then retry. |
| Name already exists | Another stack in the account used the same `project_name` + `environment`. Change `environment` in `terraform.tfvars`. |
| `curl` on Windows returns unexpected XML/HTML | Use `curl.exe`, not `curl`. |

State files (`*.tfstate`) stay on your machine under `infra/terraform/` and are gitignored. Do not commit them. For a shared/team deploy, move state to an S3 backend before collaborating.

---

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
- Tune throttling, CORS, retention: `infra/terraform/variables.tf` (or `terraform.tfvars`)
- Update agent docs: `static/llms.txt` and `static/openapi.yaml`
- Compare payload shapes: `docs/agent-friendly-payload.json` and `docs/traditional-payload.json`

After changing Lambda or static files, run `terraform apply` again from `infra/terraform`.

## Cleanup

This stack incurs small ongoing cost (CloudFront distribution, S3, log groups). Destroy it when you are done:

```powershell
cd infra\terraform
terraform destroy
```

Type `yes` when prompted. CloudFront deletion can take several minutes.

If destroy fails on the S3 bucket because it is not empty, empty the bucket in the AWS Console (or with `aws s3 rm s3://<bucket> --recursive`) and run `terraform destroy` again.
