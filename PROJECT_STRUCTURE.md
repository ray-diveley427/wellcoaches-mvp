# Project Structure

```
mpai-system/
│
├── 📄 Configuration Files
│   ├── server.js                 # Express server (main entry point: npm start)
│   ├── package.json              # Dependencies and scripts
│   ├── .env.template             # Environment variables template (copy to .env)
│   ├── .gitignore                # Git ignore rules
│   └── .env                       # ← Create this from .env.template
│
├── 📚 Documentation
│   ├── README.md                 # Quick start guide (START HERE)
│   ├── MIGRATION.md              # Migration from old system
│   ├── IMPLEMENTATION_SUMMARY.md # Architecture overview
│   ├── DELIVERY_MANIFEST.md      # Complete file inventory
│   └── FILES_READY.txt           # Status summary
│
├── ⚙️ Backend (utils/)
│   ├── mpaiInstructions.js       # MPAI system prompt (450+ lines)
│   ├── claudeHandler.js          # Claude API integration
│   └── db.js                     # DynamoDB persistence
│
├── 🎨 Frontend (public/)
│   ├── index.html                # Main UI (fully wired)
│   └── js/
│       └── api.js                # Client-side API wrapper
│
└── 📁 Reference
    └── multi-perspective-ai-demo.html  # Original mockup (for reference)
```

---

## File Purposes

### Core Application Files

#### **server.js** (Main Entry Point)
```bash
npm start  # Runs this file
```
- Express.js application
- 7 REST API endpoints
- Session management
- Error handling
- Ready to deploy

#### **utils/mpaiInstructions.js** (System Prompt)
- 450+ line MPAI framework
- All 9 perspectives defined
- 10 method-specific templates
- Bias checking protocol
- Loaded as system prompt for Claude

#### **utils/claudeHandler.js** (API Integration)
- Single responsibility: call Claude
- `callMPAI()` - Make analysis request
- `detectBandwidth()` - Determine output length
- `suggestMethod()` - Auto-select best method

#### **utils/db.js** (Database Layer)
- DynamoDB operations
- Session management
- Preference storage
- Query optimization

#### **public/index.html** (Frontend UI)
- Complete chat interface
- Method selection dropdown (all 10 methods)
- Perspective visibility toggle
- Real API integration
- 24 KB, fully functional

#### **public/js/api.js** (Client Wrapper)
- Wraps all backend endpoints
- Error handling
- Session tracking
- Used by index.html

### Configuration Files

#### **package.json**
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "...",
    "@aws-sdk/client-dynamodb": "...",
    "express": "...",
    "uuid": "..."
  },
  "scripts": {
    "start": "node server.js",
    "dev": "NODE_ENV=development node server.js"
  }
}
```

#### **.env.template**
```
NODE_ENV=development
PORT=3000
CLAUDE_API_KEY=sk-ant-...
AWS_REGION=us-east-1
DYNAMO_TABLE=mpai-sessions
```

Copy to `.env` and fill in your values.

### Documentation Files

| File | Purpose |
|------|---------|
| README.md | Quick start (5 min) & troubleshooting |
| MIGRATION.md | How to migrate from old system |
| IMPLEMENTATION_SUMMARY.md | Architecture & specifications |
| DELIVERY_MANIFEST.md | Complete file inventory |
| FILES_READY.txt | Status summary |

---

## Directory Tree Visualization

```
mpai-system/
│
├─ 📄 server.js
├─ 📄 package.json
├─ 📄 .env.template → .env
├─ 📄 .gitignore
│
├─ 📚 Documentation
│  ├─ README.md
│  ├─ MIGRATION.md
│  ├─ IMPLEMENTATION_SUMMARY.md
│  ├─ DELIVERY_MANIFEST.md
│  └─ FILES_READY.txt
│
├─ ⚙️ utils/
│  ├─ mpaiInstructions.js
│  ├─ claudeHandler.js
│  └─ db.js
│
└─ 🎨 public/
   ├─ index.html
   └─ js/
      └─ api.js
```

---

## Setup Checklist

### 1. Project Setup
- [ ] Copy all files to your project directory
- [ ] Files in correct directories:
  - [ ] `server.js` in root
  - [ ] `utils/*.js` files in utils/
  - [ ] `public/index.html` in public/
  - [ ] `public/js/api.js` in public/js/

### 2. Dependencies
- [ ] Run `npm install`
- [ ] All packages installed successfully
- [ ] node_modules/ created

### 3. Configuration
- [ ] Copy `.env.template` to `.env`
- [ ] Fill in CLAUDE_API_KEY
- [ ] Fill in AWS_REGION and DYNAMO_TABLE
- [ ] PORT is optional (defaults to 3000)

### 4. Database
- [ ] Create DynamoDB table
- [ ] Enable TTL on table
- [ ] AWS credentials configured

### 5. Testing
- [ ] Run `npm start`
- [ ] Server starts on http://localhost:3000
- [ ] Test endpoints with curl or frontend

---

## Quick Commands

```bash
# Install dependencies
npm install

# Start server
npm start

# Start in development mode
NODE_ENV=development npm start

# Test health endpoint
curl http://localhost:3000/api/health

# Create DynamoDB table
aws dynamodb create-table \
  --table-name mpai-sessions \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --ttl-specification AttributeName=ttl,Enabled=true
```

---

## File Sizes Reference

| File | Size | Purpose |
|------|------|---------|
| server.js | 6.9 KB | Backend |
| utils/mpaiInstructions.js | 13 KB | MPAI framework |
| utils/claudeHandler.js | 3.6 KB | Claude integration |
| utils/db.js | 3.9 KB | Database layer |
| public/index.html | 24 KB | Frontend UI |
| public/js/api.js | 3.8 KB | API wrapper |
| package.json | 799 B | Dependencies |
| Documentation | ~40 KB | Guides |

**Total:** ~130 KB (extremely lightweight)

---

## Next Actions

1. **Read README.md** (5 minutes)
2. **Follow quick start** (5 minutes)
3. **Test locally** (10 minutes)
4. **Deploy to production** (varies)

All files are organized and ready to go!
