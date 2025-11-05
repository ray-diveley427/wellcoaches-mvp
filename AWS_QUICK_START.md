# AWS Elastic Beanstalk - Quick Start Guide

## Prerequisites

1. **Install AWS EB CLI:**
   ```powershell
   pip install awsebcli --upgrade --user
   ```

2. **Verify installation:**
   ```powershell
   eb --version
   ```

## Deployment Steps

### Step 1: Initialize (First Time Only)

```powershell
# Run the deployment script
.\deploy-to-aws.ps1

# Choose option 1: Initialize
# Follow prompts:
# - Region: us-east-1
# - Application name: multi-perspective-ai
# - Platform: Node.js
# - Platform version: Node.js 18 on Amazon Linux 2023
# - SSH: Yes
```

### Step 2: Create Environment and Deploy

```powershell
# Run the deployment script
.\deploy-to-aws.ps1

# Choose option 2: Create and deploy environment
# Enter environment name: multi-perspective-ai-prod
# Wait 5-10 minutes for deployment
```

**OR manually:**

```powershell
eb create multi-perspective-ai-prod --instance-type t3.small
```

### Step 3: Get Your Application URL

```powershell
eb status
```

Look for: `CNAME: multi-perspective-ai-prod.us-east-1.elasticbeanstalk.com`

### Step 4: Configure SSL Certificate

1. **AWS Console → Certificate Manager (us-east-1)**
2. Request certificate for your domain
3. Add DNS validation records to GoDaddy
4. Wait for validation (~5-30 minutes)

### Step 5: Attach SSL to Load Balancer

1. **AWS Console → Elastic Beanstalk → Your Environment**
2. Configuration → Load Balancer
3. Add HTTPS listener (port 443)
4. Select your SSL certificate
5. Apply changes

### Step 6: Update DNS (GoDaddy)

Add CNAME record:
```
Type: CNAME
Name: @
Value: multi-perspective-ai-prod.us-east-1.elasticbeanstalk.com
TTL: 600
```

### Step 7: Update Cognito Callback URLs

**AWS Console → Cognito → User Pools → App Integration**

Add:
- Callback URL: `https://your-domain.com/callback`
- Sign-out URL: `https://your-domain.com/`

### Step 8: Update auth.js

Edit `public/js/auth.js` and update domain in `getBaseUrl()`:

```javascript
else if (hostname.includes("your-domain.com")) {
  return "https://your-domain.com";
}
```

Then deploy the change:
```powershell
eb deploy
```

## Common Commands

```powershell
# Deploy code changes
eb deploy

# Check status
eb status

# View logs
eb logs

# SSH into instance
eb ssh

# Restart application
eb restart

# Update environment variables
eb setenv KEY=value

# Open in browser
eb open
```

## Monitoring

**CloudWatch Logs:**
- AWS Console → CloudWatch → Logs
- Log group: `/aws/elasticbeanstalk/multi-perspective-ai-prod`

**Application Health:**
- Elastic Beanstalk dashboard shows health status

## Cost Estimate

- **Elastic Beanstalk**: Free (only pay for resources)
- **EC2 t3.small**: ~$15/month
- **Application Load Balancer**: ~$16/month
- **DynamoDB**: ~$5-20/month (usage-based)
- **Data Transfer**: ~$5-10/month
- **Total**: ~$40-60/month

## Troubleshooting

### View detailed logs
```powershell
eb logs --all
```

### SSH into server
```powershell
eb ssh
# Then: cat /var/log/eb-engine.log
```

### Application won't start
- Check CloudWatch logs
- Verify environment variables are set
- Ensure PORT=8080 (EB requirement)

### High costs
- AWS Console → Cost Explorer
- Set up budgets and alerts
- Consider reserved instances

## Security Checklist

- ✅ SSL certificate configured
- ✅ HTTPS redirect enabled
- ✅ Environment variables set (not in code)
- ✅ CloudWatch logging enabled
- ✅ DynamoDB backups configured
- ✅ Security groups properly configured

## Support

For detailed instructions, see: [AWS_DEPLOYMENT_GUIDE.md](AWS_DEPLOYMENT_GUIDE.md)
