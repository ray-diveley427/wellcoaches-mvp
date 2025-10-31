# IIS Deployment Guide

This guide will help you deploy the Multi-Perspective AI application to Windows IIS.

## Prerequisites

1. **Windows Server** with IIS installed (IIS 7.5 or higher)
2. **Node.js** (v18.0.0 or higher) - Download from [nodejs.org](https://nodejs.org/)
3. **iisnode** - IIS module for running Node.js applications

## Step 1: Install Node.js

1. Download and install Node.js v18 or higher from [nodejs.org](https://nodejs.org/)
2. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

## Step 2: Install iisnode

1. Download iisnode from:
   - **Latest Release**: [iisnode Releases](https://github.com/Azure/iisnode/releases)
   - Or use the direct installer: Download the `iisnode-full-v0.2.26-x64.msi` (or latest version) for 64-bit Windows

2. Run the installer and follow the setup wizard

3. Verify installation by checking IIS Manager → Modules - you should see "iisnode" listed

## Step 3: Deploy Your Application

1. **Create IIS Site**:
   - Open IIS Manager
   - Right-click "Sites" → "Add Website"
   - Set Site name: `wellcoaches-mvp` (or your preferred name)
   - Set Physical path: `C:\inetpub\wwwroot\wellcoaches-mvp` (or your deployment path)
   - Set Port: `80` (or your preferred port)
   - Click OK

2. **Copy Files**:
   - Copy all project files to the IIS site directory
   - Make sure `server.js`, `package.json`, `web.config`, and all directories are included
   - **Important**: Keep the directory structure intact

3. **Install Dependencies**:
   ```powershell
   cd C:\inetpub\wwwroot\wellcoaches-mvp
   npm install --production
   ```

## Step 4: Configure Environment Variables

IIS doesn't use `.env` files directly. You need to set environment variables in IIS:

### Option A: Using IIS Manager (Recommended)

1. Open IIS Manager
2. Select your site
3. Double-click "Configuration Editor"
4. Navigate to: `system.webServer/iisnode/environmentVariables`
5. Add each environment variable from your `.env` file:
   - `ANTHROPIC_API_KEY`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `ADMIN_EMAILS` (comma-separated)
   - `PORT` (optional, defaults to process.env.PORT or 3000)
   - `NODE_ENV=production`
   - `COST_LIMITS_ENABLED=false` (or `true` if you want cost limits)
   - Any other variables you use

### Option B: Using Application Settings

1. In IIS Manager, select your site
2. Double-click "Application Settings"
3. Add each setting with the format: `ANTHROPIC_API_KEY` = `your-value`

### Option C: Using web.config (Less Secure)

You can add environment variables directly to `web.config` (not recommended for production):

```xml
<iisnode>
  <environmentVariables>
    <add name="ANTHROPIC_API_KEY" value="your-key-here" />
    <add name="AWS_ACCESS_KEY_ID" value="your-key-here" />
    <add name="AWS_SECRET_ACCESS_KEY" value="your-secret-here" />
  </environmentVariables>
</iisnode>
```

## Step 5: Set Application Pool Settings

1. In IIS Manager, go to "Application Pools"
2. Find your application pool (usually matches your site name)
3. Right-click → "Advanced Settings"
4. Configure:
   - **.NET CLR Version**: "No Managed Code"
   - **Managed Pipeline Mode**: "Integrated"
   - **Identity**: Consider using a custom service account with appropriate permissions
   - **Start Mode**: "AlwaysRunning" (optional, for better performance)

## Step 6: Set Permissions

1. **IIS_IUSRS** needs read/execute permissions on your site directory
2. The application pool identity needs read/execute permissions
3. Grant permissions:
   ```powershell
   icacls "C:\inetpub\wwwroot\wellcoaches-mvp" /grant "IIS_IUSRS:(OI)(CI)RX" /T
   ```

## Step 7: Configure Static Files

Static files in the `public` directory should be served by IIS. The `web.config` includes rewrite rules to handle this, but verify:

1. IIS should serve files from `public/` directly
2. All API routes (`/api/*`) should be routed to `server.js`

## Step 8: Test Your Deployment

1. Start your site in IIS Manager
2. Browse to `http://localhost` (or your configured port)
3. Check the application in a browser
4. Check logs:
   - Application logs: `C:\inetpub\wwwroot\wellcoaches-mvp\iisnode\`
   - IIS logs: Usually in `C:\inetpub\logs\LogFiles\`

## Troubleshooting

### Application Not Starting

1. **Check iisnode installation**:
   - Verify iisnode is listed in IIS Modules
   - Restart IIS: `iisreset` in PowerShell

2. **Check Node.js**:
   ```powershell
   node --version
   ```
   Ensure it's in your system PATH

3. **Check permissions**:
   - Verify IIS_IUSRS has read/execute permissions
   - Check Application Pool identity permissions

4. **Check logs**:
   - View iisnode logs in `C:\inetpub\wwwroot\wellcoaches-mvp\iisnode\`
   - Check Windows Event Viewer → Windows Logs → Application

### 500 Errors

1. Check `iisnode` log files for detailed error messages
2. Verify all environment variables are set correctly
3. Check that `server.js` is in the root of your site directory
4. Verify `package.json` is correct and dependencies are installed

### Static Files Not Loading

1. Verify `public` directory exists and has correct permissions
2. Check `web.config` rewrite rules
3. Ensure static file handler is enabled in IIS

### Environment Variables Not Working

1. Restart the application pool after setting environment variables
2. Verify variable names match exactly (case-sensitive)
3. Use IIS Manager Configuration Editor for reliable variable setting

## Additional Configuration

### Enable HTTPS (Recommended for Production)

1. Install SSL certificate
2. Add HTTPS binding in IIS Site Bindings
3. Configure redirect HTTP → HTTPS if needed

### Performance Tuning

1. Enable output caching for static files
2. Adjust `nodeProcessCountPerApplication` in `web.config` based on your server capacity
3. Consider using Application Request Routing (ARR) for load balancing if needed

### Monitoring

- Check iisnode logs regularly
- Monitor Windows Event Viewer
- Set up Application Insights or similar monitoring solution

## Support

For issues specific to:
- **iisnode**: Check [iisnode GitHub](https://github.com/Azure/iisnode)
- **IIS**: Check [Microsoft IIS Documentation](https://docs.microsoft.com/en-us/iis/)

