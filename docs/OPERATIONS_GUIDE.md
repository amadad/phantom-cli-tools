# Agent Social - Operations Guide

## Production Deployment

### Modal Platform Setup

#### Initial Configuration
```bash
# Install Modal CLI
pip install modal

# Authenticate with Modal
modal setup

# Verify authentication
modal profile current
```

#### Secrets Management
```bash
# Create production secrets
modal secret create agent-social-secrets \
  --env AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY \
  --env AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT \
  --env AZURE_OPENAI_API_VERSION=$AZURE_OPENAI_API_VERSION \
  --env AZURE_OPENAI_DEPLOYMENT_NAME=$AZURE_OPENAI_DEPLOYMENT_NAME \
  --env COMPOSIO_API_KEY=$COMPOSIO_API_KEY \
  --env AGNO_API_KEY=$AGNO_API_KEY \
  --env SERPER_API_KEY=$SERPER_API_KEY \
  --env SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN \
  --env SLACK_APP_TOKEN=$SLACK_APP_TOKEN \
  --env SLACK_CHANNEL_ID=$SLACK_CHANNEL_ID

# Update secrets
modal secret update agent-social-secrets --env KEY=value

# List secrets (names only, not values)
modal secret list
```

### Deployment Process

#### Production Deployment
```bash
# Deploy to production
modal deploy modal_app.py

# Deploy with specific tag
modal deploy modal_app.py --tag v1.0.0

# View deployment status
modal app list
```

#### Rollback Procedure
```bash
# List recent deployments
modal app history agent-social

# Rollback to previous version
modal app rollback agent-social --to <deployment-id>

# Or redeploy previous tag
modal deploy modal_app.py --tag v0.9.0
```

### Scheduled Jobs

#### Managing Schedules
```bash
# View current schedules
modal app describe agent-social

# Pause scheduled runs
modal app pause agent-social

# Resume scheduled runs
modal app resume agent-social
```

#### Manual Execution
```bash
# Run pipeline manually
modal run modal_app.py::social_pipeline

# Trigger via webhook
curl -X POST https://your-username--agent-social.modal.run/trigger

# Check health endpoint
curl https://your-username--agent-social.modal.run/health
```

## Monitoring & Alerting

### Log Management

#### Viewing Logs
```bash
# Stream live logs
modal logs -f

# View recent logs
modal logs --limit 100

# Filter logs by function
modal logs --function social_pipeline

# Export logs
modal logs --since 1h > logs.txt
```

#### Log Analysis
```python
# Common log patterns to monitor
ERROR_PATTERNS = [
    "API rate limit",
    "Slack timeout",
    "Composio failure",
    "Azure OpenAI error"
]

# Success indicators
SUCCESS_PATTERNS = [
    "Content approved",
    "Successfully posted",
    "Pipeline completed"
]
```

### Performance Monitoring

#### Key Metrics
```yaml
pipeline_metrics:
  - execution_time: < 5 minutes
  - story_discovery: < 30 seconds
  - content_generation: < 60 seconds
  - approval_wait: < 30 minutes
  - posting_time: < 10 seconds

api_metrics:
  - azure_openai_latency: < 5 seconds
  - serper_latency: < 2 seconds
  - composio_latency: < 3 seconds
  - slack_responsiveness: < 1 second
```

#### Monitoring Dashboard
```bash
# Check Modal dashboard
open https://modal.com/apps/your-username/agent-social

# View function metrics
modal app stats agent-social

# Check resource usage
modal app describe agent-social --verbose
```

### Alert Configuration

#### Slack Alerts
```python
# Alert on pipeline failure
async def send_alert(error_type, details):
    await slack_client.chat_postMessage(
        channel=ALERTS_CHANNEL,
        text=f"🚨 Pipeline Alert: {error_type}\n```{details}```"
    )
```

#### Alert Triggers
- Pipeline execution failure
- API rate limit exceeded
- Approval timeout (no response)
- Platform posting failure
- Low API quota warnings

## Troubleshooting

### Common Issues

#### 1. Pipeline Not Running
```bash
# Check if app is paused
modal app describe agent-social

# Check recent runs
modal logs --function scheduled_social_pipeline --limit 10

# Verify cron schedule
grep "schedule" modal_app.py
```

#### 2. Slack Approval Not Working
```bash
# Test Slack connection
python -c "from social_pipeline import test_slack_connection; test_slack_connection()"

# Verify Socket Mode
# Check in Slack App settings that Socket Mode is enabled

# Check bot permissions
# Ensure bot has: chat:write, channels:read, reactions:write
```

#### 3. Content Not Posting
```bash
# Check Composio connection
composio apps list
composio connections list

# Verify platform tokens
composio connections show twitter

# Test posting manually
python -c "from social_pipeline import test_platform_posting; test_platform_posting('twitter')"
```

#### 4. API Rate Limits
```python
# Implement backoff strategy
RATE_LIMIT_DELAYS = {
    "serper": 60,      # 1 minute
    "openai": 300,     # 5 minutes
    "composio": 900    # 15 minutes
}

# Monitor API usage
async def check_api_quotas():
    quotas = {
        "serper": await get_serper_quota(),
        "openai": await get_openai_usage(),
        "composio": await get_composio_limits()
    }
    return quotas
```

### Debug Mode

#### Enable Verbose Logging
```python
# In modal_app.py
import logging
logging.basicConfig(level=logging.DEBUG)

# Or via environment
modal secret update agent-social-secrets --env LOG_LEVEL=DEBUG
```

#### Test Individual Components
```bash
# Test story discovery only
modal run modal_app.py::test_story_discovery

# Test content generation only
modal run modal_app.py::test_content_generation

# Test without posting
modal run modal_app.py::social_pipeline --test-mode
```

## Maintenance Tasks

### Daily Operations

#### Morning Checklist
1. Check overnight pipeline runs
2. Review pending approvals in Slack
3. Verify API quotas
4. Check error logs

```bash
# Morning health check script
#!/bin/bash
echo "=== Agent Social Morning Check ==="
echo "1. Recent runs:"
modal logs --limit 20 --function scheduled_social_pipeline

echo "2. Current status:"
modal app describe agent-social

echo "3. API health:"
curl https://your-username--agent-social.modal.run/health
```

### Weekly Maintenance

#### Performance Review
```python
# Analyze weekly metrics
def weekly_performance_report():
    metrics = {
        "total_runs": count_pipeline_runs(),
        "success_rate": calculate_success_rate(),
        "avg_execution_time": average_execution_time(),
        "content_approval_rate": approval_rate(),
        "platform_success_rates": platform_metrics()
    }
    return generate_report(metrics)
```

#### Content Audit
1. Review generated content quality
2. Check brand voice consistency
3. Analyze engagement metrics
4. Update brand framework if needed

### Monthly Tasks

#### API Key Rotation
```bash
# Rotate API keys monthly
# 1. Generate new keys from providers
# 2. Update Modal secrets
modal secret update agent-social-secrets --env AZURE_OPENAI_API_KEY=new_key

# 3. Test with new keys
modal run modal_app.py::test_all_apis

# 4. Remove old keys from providers
```

#### Cost Analysis
```python
# Track API usage costs
def monthly_cost_report():
    costs = {
        "azure_openai": calculate_openai_costs(),
        "serper": calculate_serper_costs(),
        "modal": get_modal_invoice(),
        "total": sum_all_costs()
    }
    return costs
```

## Disaster Recovery

### Backup Procedures

#### Content Archive
```bash
# Backup generated content
aws s3 sync output/ s3://agent-social-backups/output/

# Or using git
git add output/
git commit -m "Content backup $(date +%Y%m%d)"
git push origin content-backup
```

#### Configuration Backup
```bash
# Backup brand configurations
cp -r brands/ brands-backup-$(date +%Y%m%d)/

# Backup Modal configuration
modal app export agent-social > modal-config-backup.json
```

### Recovery Procedures

#### Service Outage Recovery
```yaml
recovery_steps:
  modal_outage:
    - Run locally: python social_pipeline.py
    - Use backup scheduler (GitHub Actions)
    - Manual execution via cron
  
  slack_outage:
    - Switch to email approvals
    - Auto-approve with strict rules
    - Queue for later approval
  
  api_outage:
    - Use cached stories
    - Switch to backup AI provider
    - Pause pipeline until resolved
```

#### Data Recovery
```bash
# Restore from backup
aws s3 sync s3://agent-social-backups/output/ output/

# Restore Modal app
modal app import modal-config-backup.json
```

## Security Operations

### Access Management

#### Modal Access
```bash
# List team members
modal team members list

# Add team member
modal team members add user@example.com

# Set permissions
modal team members update user@example.com --role developer
```

#### Slack Access
- Limit approval channel to authorized users
- Regular audit of channel members
- Use private channel for approvals

### Security Checklist

#### Daily
- [ ] Check for unusual API usage
- [ ] Verify no unauthorized deployments
- [ ] Review Slack approval patterns

#### Weekly
- [ ] Audit Modal access logs
- [ ] Review API key usage
- [ ] Check for security updates

#### Monthly
- [ ] Rotate API keys
- [ ] Review team access
- [ ] Security dependency updates

## Performance Optimization

### Caching Strategy
```python
# Implement story caching
STORY_CACHE = TTLCache(maxsize=100, ttl=3600)

# Cache generated content
CONTENT_CACHE = TTLCache(maxsize=50, ttl=1800)

# Cache API responses
@lru_cache(maxsize=32)
def get_brand_framework(brand_name):
    return load_yaml(f"brands/{brand_name}.yaml")
```

### Resource Optimization
```python
# Modal resource configuration
@app.function(
    memory=1024,  # Reduce if not needed
    cpu=1.0,      # Adjust based on load
    timeout=600   # 10 minutes max
)
```

### Cost Optimization
- Use O4-mini for discovery (cheaper)
- Batch API calls where possible
- Implement request caching
- Monitor and optimize Modal resources

---

*Operations guide for maintaining a reliable, secure, and efficient social media automation pipeline.*