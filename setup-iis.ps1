# PowerShell script to help set up IIS deployment
# Run this script as Administrator

param(
    [string]$SiteName = "wellcoaches-mvp",
    [string]$SitePath = "C:\inetpub\wwwroot\wellcoaches-mvp",
    [int]$Port = 80
)

Write-Host "IIS Deployment Setup Script" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Check if IIS is installed
Write-Host "Checking IIS installation..." -ForegroundColor Cyan
$iisFeature = Get-WindowsFeature -Name Web-Server
if (-not $iisFeature.Installed) {
    Write-Host "IIS is not installed. Installing..." -ForegroundColor Yellow
    Install-WindowsFeature -Name Web-Server -IncludeManagementTools
    Write-Host "IIS installed. Please install required features (ASP.NET, etc.) if needed." -ForegroundColor Green
} else {
    Write-Host "IIS is installed." -ForegroundColor Green
}

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js v18 or higher from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if iisnode is installed
Write-Host "Checking iisnode installation..." -ForegroundColor Cyan
$iisnodeModule = Get-WebGlobalModule | Where-Object { $_.Name -eq "iisnode" }
if (-not $iisnodeModule) {
    Write-Host "WARNING: iisnode module not found!" -ForegroundColor Yellow
    Write-Host "Please download and install iisnode from:" -ForegroundColor Yellow
    Write-Host "https://github.com/Azure/iisnode/releases" -ForegroundColor Cyan
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
} else {
    Write-Host "iisnode module found." -ForegroundColor Green
}

# Check if site directory exists
Write-Host "Checking site directory..." -ForegroundColor Cyan
if (-not (Test-Path $SitePath)) {
    Write-Host "Site directory does not exist: $SitePath" -ForegroundColor Yellow
    Write-Host "Creating directory..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $SitePath -Force | Out-Null
    Write-Host "Directory created. Please copy your application files to: $SitePath" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Have you copied all application files? (y/n)"
    if ($continue -ne "y") {
        Write-Host "Please copy all files and run this script again." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "Site directory exists: $SitePath" -ForegroundColor Green
}

# Check if web.config exists
if (-not (Test-Path "$SitePath\web.config")) {
    Write-Host "WARNING: web.config not found in site directory!" -ForegroundColor Yellow
    Write-Host "Make sure web.config is in the site root directory." -ForegroundColor Yellow
}

# Check if server.js exists
if (-not (Test-Path "$SitePath\server.js")) {
    Write-Host "ERROR: server.js not found in site directory!" -ForegroundColor Red
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "$SitePath\node_modules")) {
    Write-Host "node_modules not found. Installing dependencies..." -ForegroundColor Cyan
    Set-Location $SitePath
    npm install --production
    Set-Location $PSScriptRoot
} else {
    Write-Host "Dependencies found." -ForegroundColor Green
}

# Create IIS site
Write-Host "Creating IIS site..." -ForegroundColor Cyan
$existingSite = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($existingSite) {
    Write-Host "Site '$SiteName' already exists. Skipping site creation." -ForegroundColor Yellow
} else {
    New-Website -Name $SiteName -Port $Port -PhysicalPath $SitePath | Out-Null
    Write-Host "IIS site created: $SiteName" -ForegroundColor Green
}

# Create Application Pool
Write-Host "Creating Application Pool..." -ForegroundColor Cyan
$existingPool = Get-IISAppPool -Name $SiteName -ErrorAction SilentlyContinue
if ($existingPool) {
    Write-Host "Application Pool '$SiteName' already exists." -ForegroundColor Yellow
} else {
    New-WebAppPool -Name $SiteName | Out-Null
    Set-ItemProperty "IIS:\AppPools\$SiteName" -Name managedRuntimeVersion -Value ""
    Set-ItemProperty "IIS:\AppPools\$SiteName" -Name enable32BitAppOnWin64 -Value $false
    Write-Host "Application Pool created: $SiteName" -ForegroundColor Green
}

# Set Application Pool for site
Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $SiteName
Write-Host "Application Pool assigned to site." -ForegroundColor Green

# Set permissions
Write-Host "Setting permissions..." -ForegroundColor Cyan
$acl = Get-Acl $SitePath
$permission = "IIS_IUSRS", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($accessRule)

$appPoolIdentity = "IIS AppPool\$SiteName"
try {
    $permission2 = $appPoolIdentity, "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow"
    $accessRule2 = New-Object System.Security.AccessControl.FileSystemAccessRule $permission2
    $acl.SetAccessRule($accessRule2)
} catch {
    Write-Host "Note: Could not set permissions for AppPool identity. You may need to set this manually." -ForegroundColor Yellow
}

Set-Acl $SitePath $acl
Write-Host "Permissions set." -ForegroundColor Green

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open IIS Manager" -ForegroundColor White
Write-Host "2. Select your site: $SiteName" -ForegroundColor White
Write-Host "3. Configure environment variables in Configuration Editor" -ForegroundColor White
Write-Host "4. Set the following environment variables:" -ForegroundColor White
Write-Host "   - ANTHROPIC_API_KEY" -ForegroundColor Yellow
Write-Host "   - AWS_ACCESS_KEY_ID" -ForegroundColor Yellow
Write-Host "   - AWS_SECRET_ACCESS_KEY" -ForegroundColor Yellow
Write-Host "   - ADMIN_EMAILS" -ForegroundColor Yellow
Write-Host "   - NODE_ENV=production" -ForegroundColor Yellow
Write-Host "5. Restart the application pool" -ForegroundColor White
Write-Host "6. Browse to: http://localhost:$Port" -ForegroundColor White
Write-Host ""
Write-Host "For detailed instructions, see DEPLOY_IIS.md" -ForegroundColor Cyan

