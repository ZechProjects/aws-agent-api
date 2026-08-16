output "api_base_url" {
  description = "Base URL for HTTP API"
  value       = aws_apigatewayv2_api.agent_api.api_endpoint
}

output "health_url" {
  description = "Health endpoint URL"
  value       = "${aws_apigatewayv2_api.agent_api.api_endpoint}/v1/health"
}

output "mock_url" {
  description = "Mock completion endpoint URL"
  value       = "${aws_apigatewayv2_api.agent_api.api_endpoint}/v1/agent/mock"
}

output "legacy_mock_url" {
  description = "Traditional (not agent-friendly) mock completion endpoint URL"
  value       = "${aws_apigatewayv2_api.agent_api.api_endpoint}/legacy/exec"
}

output "cloudfront_domain_name" {
  description = "CloudFront domain hosting robots.txt and llms.txt"
  value       = aws_cloudfront_distribution.agent_docs.domain_name
}

output "robots_txt_url" {
  description = "robots.txt URL"
  value       = "https://${aws_cloudfront_distribution.agent_docs.domain_name}/robots.txt"
}

output "llms_txt_url" {
  description = "llms.txt URL"
  value       = "https://${aws_cloudfront_distribution.agent_docs.domain_name}/llms.txt"
}
