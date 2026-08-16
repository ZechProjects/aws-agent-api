variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used as a prefix for resources"
  type        = string
  default     = "aws-agent-api"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "cors_allowed_origins" {
  description = "Allowed CORS origins for API Gateway"
  type        = list(string)
  default     = ["*"]
}

variable "api_throttling_burst_limit" {
  description = "Default burst throttle limit for API routes"
  type        = number
  default     = 100
}

variable "api_throttling_rate_limit" {
  description = "Default steady-state throttle limit (requests per second)"
  type        = number
  default     = 50
}

variable "log_retention_days" {
  description = "CloudWatch log retention days"
  type        = number
  default     = 14
}
