# AWS Elastic Beanstalk Deployment Script for Multi-Perspective AI
# Run this script to initialize and deploy your application to AWS

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AWS Elastic Beanstalk Deployment" -ForegroundColor Cyan
Write-Host "Multi-Perspective AI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if EB CLI is installed
Write-Host "Checking for AWS EB CLI..." -ForegroundColor Yellow
if (!(Get-Command "eb" -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: AWS EB CLI not found!" -ForegroundColor Red
    Write-Host "Install it with: pip install awsebcli --upgrade --user" -ForegroundColor Yellow
    Write-Host "Or download from: https://github.com/aws/aws-elastic-beanstalk-cli-setup" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ EB CLI found" -ForegroundColor Green
Write-Host ""

# Check for .env file
if (!(Test-Path ".env")) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your environment variables" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ .env file found" -ForegroundColor Green
Write-Host ""

# Load environment variables from .env
Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
$envVars = @{}
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# Build environment variables string for EB
$ebEnvVars = ($envVars.GetEnumerator() | ForEach-Object {
    "$($_.Key)=$($_.Value)"
}) -join ","

Write-Host "✓ Loaded $($envVars.Count) environment variables" -ForegroundColor Green
Write-Host ""

# Ask user what they want to do
Write-Host "What would you like to do?" -ForegroundColor Cyan
Write-Host "1. Initialize new EB application (first time only)" -ForegroundColor White
Write-Host "2. Create and deploy environment" -ForegroundColor White
Write-Host "3. Deploy code changes to existing environment" -ForegroundColor White
Write-Host "4. Check environment status" -ForegroundColor White
Write-Host "5. View logs" -ForegroundColor White
Write-Host "6. Open application in browser" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-6)"

switch ($choice) {
    "1" {
        Write-Host "`nInitializing Elastic Beanstalk..." -ForegroundColor Yellow
        Write-Host "Follow the prompts:" -ForegroundColor Cyan
        Write-Host "- Region: us-east-1" -ForegroundColor White
        Write-Host "- Application name: multi-perspective-ai" -ForegroundColor White
        Write-Host "- Platform: Node.js" -ForegroundColor White
        Write-Host "- Platform version: Node.js 18 on Amazon Linux 2023" -ForegroundColor White
        Write-Host "- SSH: Yes (recommended)" -ForegroundColor White
        Write-Host ""
        eb init
    }
    "2" {
        Write-Host "`nCreating environment and deploying..." -ForegroundColor Yellow
        Write-Host "This will take 5-10 minutes..." -ForegroundColor Cyan
        Write-Host ""

        $envName = Read-Host "Environment name (e.g., multi-perspective-ai-prod)"
        if ([string]::IsNullOrWhiteSpace($envName)) {
            $envName = "multi-perspective-ai-prod"
        }

        Write-Host "Creating environment: $envName" -ForegroundColor Green
        Write-Host "Instance type: t3.small (2GB RAM, ~$15/month)" -ForegroundColor White
        Write-Host ""

        # Create environment with all env vars
        eb create $envName --instance-type t3.small --envvars $ebEnvVars

        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✓ Deployment complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Get your EB URL: eb status" -ForegroundColor White
        Write-Host "2. Configure SSL certificate in AWS Console" -ForegroundColor White
        Write-Host "3. Update GoDaddy DNS to point to EB URL" -ForegroundColor White
        Write-Host "4. Update Cognito callback URLs" -ForegroundColor White
        Write-Host ""
    }
    "3" {
        Write-Host "`nDeploying code changes..." -ForegroundColor Yellow
        eb deploy

        Write-Host ""
        Write-Host "✓ Deployment complete!" -ForegroundColor Green
    }
    "4" {
        Write-Host "`nChecking environment status..." -ForegroundColor Yellow
        eb status
    }
    "5" {
        Write-Host "`nFetching logs..." -ForegroundColor Yellow
        eb logs
    }
    "6" {
        Write-Host "`nOpening application in browser..." -ForegroundColor Yellow
        eb open
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
