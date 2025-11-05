# AWS Deployment Guide for Multi-Perspective AI

Complete step-by-step guide to deploy your application to AWS with your GoDaddy domain.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Option A: AWS Elastic Beanstalk (Recommended)](#option-a-elastic-beanstalk)
3. [Option B: AWS EC2 with ALB](#option-b-ec2-with-alb)
4. [Domain Configuration (GoDaddy)](#domain-configuration)
5. [SSL Certificate Setup](#ssl-certificate-setup)
6. [Post-Deployment Configuration](#post-deployment)

---

## Prerequisites

### What You'll Need:
- ✅ AWS Account (create at https://aws.amazon.com if you don't have one)
- ✅ GoDaddy domain name
- ✅ AWS CLI installed (optional but helpful)
- ✅ Your current `.env` file with credentials
- ✅ DynamoDB table: `mpai-sessions` (already configured)
- ✅ AWS Cognito (already configured)

### Your Current AWS Resources:
- **Region**: us-east-1
- **DynamoDB Table**: mpai-sessions
- **AWS Credentials**: Configured in .env file
- **Cognito**: Already configured

---

## Option A: AWS Elastic Beanstalk (Recommended - Easiest)

Elastic Beanstalk automatically handles deployment, scaling, monitoring, and load balancing.

### Step 1: Prepare Your Application

#### 1.1 Create `.ebignore` file
Create a file named `.ebignore` in your project root:

```
node_modules/
.git/
.env
*.log
.vscode/
test.html
web.config
iisnode/
```

#### 1.2 Create Elastic Beanstalk configuration
Create folder `.ebextensions` in your project root, then create file `.ebextensions/nodecommand.config`:

```yaml
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "node server.js"
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 8080
```

#### 1.3 Update package.json (already correct)
Your `package.json` already has the correct start script:
```json
"scripts": {
  "start": "node server.js"
}
```

#### 1.4 Create `.npmrc` file (to ensure proper installation)
```
engine-strict=true
```

### Step 2: Install AWS Elastic Beanstalk CLI

**Windows (PowerShell as Administrator):**
```powershell
pip install awsebcli --upgrade --user
```

**Or download installer:**
https://github.com/aws/aws-elastic-beanstalk-cli-setup

### Step 3: Initialize Elastic Beanstalk

Open PowerShell in your project directory (`c:\scripts\wellcoaches-mvp`):

```powershell
# Initialize EB application
eb init

# Follow prompts:
# 1. Select region: us-east-1 (same as your DynamoDB)
# 2. Application name: multi-perspective-ai
# 3. Platform: Node.js
# 4. Platform version: Node.js 18 running on 64bit Amazon Linux 2023
# 5. SSH: Yes (recommended for troubleshooting)
# 6. Create keypair: Yes (create new or use existing)
```

### Step 4: Create Environment and Deploy

```powershell
# Create production environment
# NOTE: Use deploy-to-aws.ps1 script instead - it will automatically load your .env variables
# Or manually set environment variables from your .env file:
eb create multi-perspective-ai-prod --instance-type t3.small --envvars \
  CLAUDE_API_KEY=your-claude-api-key,\
  AWS_ACCESS_KEY_ID=your-aws-access-key,\
  AWS_SECRET_ACCESS_KEY=your-aws-secret-key,\
  AWS_REGION=us-east-1,\
  DYNAMO_TABLE=mpai-sessions,\
  NODE_ENV=production,\
  ADMIN_EMAILS=your-admin-emails,\
  COST_LIMITS_ENABLED=false
```

**Note**: `t3.small` provides 2GB RAM and 2 vCPUs (~$15/month). For higher traffic, use `t3.medium`.

This will:
- Create load balancer
- Launch EC2 instance
- Deploy your application
- Provide a temporary URL (e.g., `multi-perspective-ai-prod.us-east-1.elasticbeanstalk.com`)

### Step 5: Configure Environment (AWS Console)

1. Go to AWS Console → Elastic Beanstalk
2. Select your environment: `multi-perspective-ai-prod`
3. **Configuration → Security:**
   - Attach IAM role with permissions:
     - `AmazonDynamoDBFullAccess`
     - `AmazonCognitoPowerUser`
4. **Configuration → Load Balancer:**
   - Enable HTTPS (port 443)
   - We'll add SSL certificate later
5. **Configuration → Capacity:**
   - Environment type: Load balanced
   - Min instances: 1
   - Max instances: 4 (for auto-scaling)

### Step 6: Deploy Updates (Future)

Whenever you make code changes:

```powershell
# Deploy latest code
eb deploy

# Check status
eb status

# View logs
eb logs

# Open application in browser
eb open
```

---

## Option B: AWS EC2 with Application Load Balancer

For more control over your infrastructure.

### Step 1: Launch EC2 Instance

1. **Go to EC2 Dashboard:**
   - AWS Console → EC2 → Launch Instance

2. **Configure Instance:**
   - **Name**: multi-perspective-ai-prod
   - **AMI**: Amazon Linux 2023
   - **Instance type**: t3.small (2GB RAM, 2 vCPUs)
   - **Key pair**: Create new or use existing
   - **Network settings**:
     - Create security group
     - Allow SSH (port 22) from your IP
     - Allow HTTP (port 80) from anywhere
     - Allow HTTPS (port 443) from anywhere
     - Allow Custom TCP (port 3000) from your IP (for testing)
   - **Storage**: 20GB gp3

3. **Launch instance**

### Step 2: Connect to EC2 and Setup

```bash
# Connect via SSH (from your terminal)
ssh -i your-key.pem ec2-user@<your-ec2-public-ip>

# Update system
sudo yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version  # Should show v18.x
npm --version

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo yum install -y git
```

### Step 3: Deploy Application

```bash
# Clone your repository (or upload via SCP)
git clone https://github.com/ray-diveley427/wellcoaches-mvp.git
cd wellcoaches-mvp

# Or upload via SCP from your local machine:
# scp -i your-key.pem -r c:\scripts\wellcoaches-mvp ec2-user@<ec2-ip>:~/

# Install dependencies
npm install --production

# Create .env file
nano .env
```

Paste your environment variables (copy from your local .env file):
```
NODE_ENV=production
PORT=3000

CLAUDE_API_KEY=your-claude-api-key
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
DYNAMO_TABLE=mpai-sessions

ADMIN_EMAILS=your-admin-emails
COST_LIMITS_ENABLED=false
```

Save and exit (Ctrl+X, Y, Enter)

```bash
# Start application with PM2
pm2 start server.js --name multi-perspective-ai

# Set PM2 to start on boot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs
```

### Step 4: Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo yum install -y nginx

# Configure Nginx
sudo nano /etc/nginx/conf.d/multi-perspective.conf
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Test configuration
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### Step 5: Create Application Load Balancer (Optional but Recommended)

1. **Go to EC2 Dashboard → Load Balancers → Create**
2. **Type**: Application Load Balancer
3. **Name**: mpai-alb
4. **Scheme**: Internet-facing
5. **IP address type**: IPv4
6. **Network**: Select all availability zones
7. **Security group**: Allow HTTP (80) and HTTPS (443)
8. **Target group**:
   - Name: mpai-targets
   - Protocol: HTTP
   - Port: 80
   - Health check path: `/`
9. **Register targets**: Select your EC2 instance
10. **Create load balancer**

---

## Domain Configuration (GoDaddy)

You have two options:

### Option 1: Keep DNS at GoDaddy (Simpler)

1. **Go to GoDaddy DNS Management:**
   - Login to GoDaddy
   - My Products → Domain → DNS

2. **Update DNS Records:**

   **If using Elastic Beanstalk:**
   - Get your EB URL: `multi-perspective-ai-prod.us-east-1.elasticbeanstalk.com`

   Add/Update these records:
   ```
   Type: CNAME
   Name: @
   Value: multi-perspective-ai-prod.us-east-1.elasticbeanstalk.com
   TTL: 600

   Type: CNAME
   Name: www
   Value: multi-perspective-ai-prod.us-east-1.elasticbeanstalk.com
   TTL: 600
   ```

   **If using EC2 with Load Balancer:**
   - Get your ALB DNS name from AWS Console

   Add/Update:
   ```
   Type: CNAME
   Name: @
   Value: mpai-alb-1234567890.us-east-1.elb.amazonaws.com
   TTL: 600

   Type: CNAME
   Name: www
   Value: mpai-alb-1234567890.us-east-1.elb.amazonaws.com
   TTL: 600
   ```

3. **Wait for DNS propagation** (5-30 minutes)

### Option 2: Use AWS Route 53 (More AWS Integration)

1. **Create Hosted Zone in Route 53:**
   - AWS Console → Route 53 → Hosted Zones → Create
   - Domain name: your-domain.com
   - Type: Public hosted zone

2. **Get Route 53 Name Servers:**
   - Route 53 will provide 4 name servers (e.g., ns-1234.awsdns-12.org)

3. **Update GoDaddy Nameservers:**
   - GoDaddy → Domain Settings → Nameservers
   - Change to "Custom"
   - Enter all 4 Route 53 nameservers
   - Save (takes 24-48 hours to fully propagate)

4. **Create Route 53 Records:**
   - Type: A (Alias)
   - Name: (leave blank for root domain)
   - Alias: Yes
   - Alias Target: Select your Load Balancer or EB environment
   - Routing Policy: Simple

   Repeat for `www` subdomain

---

## SSL Certificate Setup

### Step 1: Request Certificate in AWS Certificate Manager

1. **Go to AWS Certificate Manager (ACM):**
   - **IMPORTANT**: Must be in `us-east-1` region for CloudFront/ALB
   - AWS Console → Certificate Manager → Request certificate

2. **Request public certificate:**
   - Certificate type: Public
   - Fully qualified domain name: `your-domain.com`
   - Add another name: `*.your-domain.com` (wildcard for subdomains)
   - Validation method: **DNS validation** (recommended)
   - Key algorithm: RSA 2048

3. **Validate domain ownership:**
   - ACM will show CNAME records to add
   - Copy the CNAME Name and Value

4. **Add validation CNAME to GoDaddy:**
   - Go to GoDaddy DNS Management
   - Add new CNAME record with ACM's values
   - Wait 5-30 minutes for validation
   - Certificate status will change to "Issued"

### Step 2: Attach Certificate to Load Balancer

**For Elastic Beanstalk:**
1. AWS Console → Elastic Beanstalk → Your environment
2. Configuration → Load Balancer
3. Add listener:
   - Port: 443
   - Protocol: HTTPS
   - SSL certificate: Select your ACM certificate
4. Apply changes

**For ALB (EC2 option):**
1. EC2 → Load Balancers → Your ALB
2. Listeners → Add listener
   - Protocol: HTTPS
   - Port: 443
   - Default action: Forward to your target group
   - Security policy: ELBSecurityPolicy-TLS-1-2-2017-01
   - Certificate: Select your ACM certificate
3. Save

### Step 3: Force HTTPS Redirect

**For Elastic Beanstalk:**
Create `.ebextensions/https-redirect.config`:
```yaml
files:
  "/etc/nginx/conf.d/https_redirect.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      server {
        listen 8080;
        if ($http_x_forwarded_proto = 'http') {
          return 301 https://$host$request_uri;
        }
      }
```

Then deploy: `eb deploy`

**For Nginx on EC2:**
Update `/etc/nginx/conf.d/multi-perspective.conf`:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Post-Deployment Configuration

### 1. Update Cognito Callback URLs

1. **AWS Console → Cognito → User Pools**
2. Select your user pool
3. **App Integration → App client settings**
4. Add your new domain to:
   - Callback URLs: `https://your-domain.com/callback`
   - Sign-out URLs: `https://your-domain.com/`

### 2. Update auth.js with Your Domain

Update `public/js/auth.js`:
```javascript
function getBaseUrl() {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  if (hostname.includes("localhost")) {
    return "http://localhost:3000";
  } else if (hostname.includes("dev.wellcoachesschool.com")) {
    return "http://multi-perspective.dev.wellcoachesschool.com";
  } else if (hostname.includes("your-domain.com")) {
    return "https://your-domain.com";  // Your new production domain
  } else {
    return `${protocol}//${hostname}${window.location.port ? `:${window.location.port}` : ''}`;
  }
}
```

### 3. Set Up Monitoring

**CloudWatch Logs (Automatic with Elastic Beanstalk):**
- AWS Console → CloudWatch → Logs
- Log group: `/aws/elasticbeanstalk/multi-perspective-ai-prod`

**Create Alarms:**
1. CloudWatch → Alarms → Create Alarm
2. Set alarms for:
   - High CPU usage (> 80%)
   - High memory usage (> 80%)
   - Application errors
   - DynamoDB throttling

### 4. Set Up Automatic Backups

**DynamoDB Backup:**
1. DynamoDB → Tables → mpai-sessions
2. Backups → Enable point-in-time recovery
3. On-demand backups → Create backup (manual)

**Or use AWS Backup:**
- AWS Backup → Create backup plan
- Add resource: DynamoDB table `mpai-sessions`
- Schedule: Daily at 2 AM UTC

### 5. Cost Optimization

**Set up AWS Budgets:**
1. AWS Console → AWS Budgets
2. Create budget
3. Set monthly limit (e.g., $50/month)
4. Email alerts at 80%, 100%, 120%

**Estimated Monthly Costs:**
- Elastic Beanstalk (t3.small): ~$15
- Application Load Balancer: ~$16
- DynamoDB (on-demand): ~$5-20 (depends on usage)
- Data transfer: ~$5-10
- **Total: ~$40-60/month**

---

## Quick Reference Commands

### Elastic Beanstalk
```powershell
# Deploy changes
eb deploy

# Check status
eb status

# View logs
eb logs

# SSH into instance
eb ssh

# Update environment variables
eb setenv CLAUDE_API_KEY=new-key

# Restart application
eb restart
```

### EC2 (via SSH)
```bash
# View application logs
pm2 logs

# Restart application
pm2 restart multi-perspective-ai

# Update code
cd ~/wellcoaches-mvp
git pull
npm install
pm2 restart multi-perspective-ai

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## Troubleshooting

### Application won't start
```bash
# Check logs
eb logs  # Elastic Beanstalk
pm2 logs  # EC2

# Common issues:
# - Missing environment variables
# - Port conflicts (ensure PORT=8080 for EB)
# - Node version mismatch
```

### SSL certificate not working
- Ensure certificate is in `us-east-1` region
- Verify DNS validation records in GoDaddy
- Wait for DNS propagation (up to 48 hours)
- Check load balancer listener configuration

### High costs
- Enable AWS Cost Explorer
- Review DynamoDB on-demand pricing
- Consider reserved instances for EC2
- Set up auto-scaling to scale down during low traffic

---

## Security Checklist

- ✅ SSL certificate installed (HTTPS)
- ✅ Environment variables set (not in code)
- ✅ Security groups configured (minimal access)
- ✅ IAM roles with least privilege
- ✅ DynamoDB encryption at rest (enabled by default)
- ✅ Regular backups configured
- ✅ CloudWatch monitoring enabled
- ✅ AWS WAF (optional - protects against attacks)

---

## Support Resources

- AWS Documentation: https://docs.aws.amazon.com
- Elastic Beanstalk: https://docs.aws.amazon.com/elasticbeanstalk
- Route 53: https://docs.aws.amazon.com/route53
- Certificate Manager: https://docs.aws.amazon.com/acm

---

**Need help? Contact AWS Support or consult the documentation above.**

Good luck with your deployment! 🚀
