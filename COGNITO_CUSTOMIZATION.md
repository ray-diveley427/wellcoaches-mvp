# Amazon Cognito Hosted UI Customization

Amazon Cognito allows you to customize the appearance of the hosted sign-in UI to match your brand.

## How to Customize Cognito Hosted UI

### Option 1: AWS Console (Visual Editor - Recommended)

1. **Navigate to Cognito Console:**
   - Go to AWS Console → Cognito → User Pools
   - Select your user pool
   - Click "Sign-in experience" tab
   - Scroll to "Hosted UI" section

2. **Customize Appearance:**
   - Click "Edit" or "Customize" button
   - Upload your logo (recommended: 200x60px PNG with transparent background)
   - Set background color, text color, and button styles
   - Choose font family (Inter is available)
   - Add custom CSS if needed

3. **Save and Test:**
   - Click "Save changes"
   - Test by visiting your Cognito domain sign-in URL

### Option 2: AWS CLI / SDK

You can programmatically customize the UI using AWS CLI:

```bash
aws cognito-idp set-ui-customization \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --css "YOUR_CUSTOM_CSS" \
  --image-file file://path/to/logo.png
```

### Option 3: CSS Customization

Cognito supports custom CSS. Create a CSS file and upload it:

**Recommended CSS to match Multi-Perspective AI branding:**

```css
:root {
  --primary-color: #14b8a6;
  --primary-dark: #0d9488;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --background: #ffffff;
  --border-color: #e5e7eb;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--text-primary);
}

/* Logo area */
.logo-customizable {
  max-width: 200px;
}

/* Button styling */
.submitButton-customizable {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 500;
  transition: all 0.2s;
}

.submitButton-customizable:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(20, 184, 166, 0.3);
}

/* Input fields */
.inputField-customizable {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
}

.inputField-customizable:focus {
  border-color: var(--primary-color);
  outline: none;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.1);
}

/* Text colors */
.label-customizable {
  color: var(--text-primary);
  font-weight: 500;
}

.textDescription-customizable {
  color: var(--text-secondary);
}
```

## Current Cognito Configuration

- **Domain:** `us-east-1eucicqax3.auth.us-east-1.amazoncognito.com`
- **Client ID:** `7m3hp4bdldr9642grf15rhhp24`
- **Sign-in URL:** `https://us-east-1eucicqax3.auth.us-east-1.amazoncognito.com/oauth2/authorize?client_id=7m3hp4bdldr9642grf15rhhp24&response_type=code&scope=openid+email+phone&redirect_uri=YOUR_REDIRECT_URI`

## Brand Colors

Use these colors to match Multi-Perspective AI branding:

- **Primary (Teal):** `#14b8a6`
- **Primary Dark:** `#0d9488`
- **Primary Light:** `#5eead4`
- **Purple Dark:** `#1e0a29`
- **Purple Medium:** `#3b1050`
- **Text Primary:** `#1f2937`
- **Text Secondary:** `#6b7280`
- **Background:** `#ffffff`

## Logo Requirements

- **Format:** PNG with transparent background
- **Size:** Recommended 200x60px (or 3:1 ratio)
- **File Size:** Max 100KB
- **Background:** Transparent recommended for best appearance

## Limitations

- Custom CSS has some restrictions (some selectors may not work)
- Custom images must be uploaded (cannot use external URLs)
- Some Cognito UI elements cannot be customized
- Customizations apply to all clients in the user pool (unless using separate user pools)

## Alternative: Custom Auth Pages

If you need more control, consider:
1. Building custom auth pages hosted on your domain
2. Using Cognito's API directly (not hosted UI)
3. Using a library like `aws-amplify` with custom UI components

