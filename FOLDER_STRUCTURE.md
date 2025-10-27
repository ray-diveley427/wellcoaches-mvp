# Properly Organized Folder Structure

Here's the complete, properly organized structure with CSS, JS, and HTML separated:

```
wellcoaches-mvp/
│
├── 📄 Root Files (Configuration)
│   ├── server.js                 ← Main backend entry point
│   ├── package.json              ← Dependencies
│   ├── .env.template             ← Environment variables (copy to .env)
│   ├── .gitignore                ← Git rules
│   └── .env                       ← Your configuration (create from template)
│
├── 📁 config/
│   └── database.js               ← Database configuration (optional)
│
├── 📁 utils/ (Backend Logic)
│   ├── mpaiInstructions.js       ← MPAI system prompt & methods
│   ├── claudeHandler.js          ← Claude API integration
│   └── db.js                     ← DynamoDB operations
│
├── 📁 public/ (Frontend)
│   ├── index.html                ← Main HTML (clean, no inline CSS/JS)
│   │
│   ├── 🎨 css/
│   │   └── styles.css            ← All CSS styles
│   │
│   ├── 📜 js/
│   │   ├── api.js                ← API wrapper (calls backend endpoints)
│   │   └── app.js                ← Main application logic
│   │
│   ├── images/                   ← (optional) Images, icons, logos
│   │   └── logo.png
│   │
│   └── assets/                   ← (optional) Other assets
│
├── 📁 docs/ (Documentation)
│   ├── README.md                 ← Quick start
│   ├── START_HERE.txt            ← For first-time users
│   ├── PROJECT_STRUCTURE.md      ← File organization
│   ├── MIGRATION.md              ← Migration from old system
│   ├── IMPLEMENTATION_SUMMARY.md ← Architecture overview
│   └── DELIVERY_MANIFEST.md      ← File inventory
│
├── 📁 logs/ (Logging)
│   └── (log files generated at runtime)
│
└── 📁 node_modules/ (Created by npm install)
    └── (dependencies)
```

---

## File Breakdown

### Root Level Files

**server.js**
- Express.js application entry point
- Defines all API routes
- Handles requests/responses
- Run with: `npm start`

**package.json**
- NPM dependencies configuration
- Run scripts
- Project metadata

**.env.template**
- Copy to `.env` and fill in your values
- Contains: CLAUDE_API_KEY, AWS_REGION, DYNAMO_TABLE, PORT

**.gitignore**
- Tells Git which files to ignore
- Includes: .env, node_modules, logs, .DS_Store

---

### /utils/ (Backend Logic)

All backend business logic goes here:

**mpaiInstructions.js** (13 KB)
- Complete MPAI system prompt
- 9 perspectives definitions
- 10 method-specific templates
- Bias checking protocol

**claudeHandler.js** (3.6 KB)
- Handles all Claude API calls
- Bandwidth detection
- Method suggestion
- Error handling

**db.js** (3.9 KB)
- DynamoDB operations
- Session management
- Preference persistence
- Query functions

---

### /public/ (Frontend)

#### index.html
```html
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="/css/styles.css">
  </head>
  <body>
    <!-- HTML structure only, no CSS or JS -->
    <script src="/js/api.js"></script>
    <script src="/js/app.js"></script>
  </body>
</html>
```
- **ONLY** HTML structure
- References external CSS and JS
- No inline styles or scripts

#### /css/ folder
```
css/
└── styles.css (ALL CSS)
    ├── Color variables (--teal, --purple, etc.)
    ├── Layout styles (.header, .main, .chat-container)
    ├── Component styles (.dropdown, .message, .button)
    ├── Animations (@keyframes fadeIn, pulse)
    └── Responsive styles
```

#### /js/ folder
```
js/
├── api.js (API wrapper)
│   ├── mpaiAPI.analyze()         ← Main analysis call
│   ├── mpaiAPI.getSession()      ← Get session data
│   ├── mpaiAPI.getSessions()     ← List all sessions
│   ├── mpaiAPI.createSession()   ← Create new session
│   ├── mpaiAPI.suggestMethod()   ← Get method suggestion
│   ├── mpaiAPI.savePreference()  ← Save preferences
│   └── mpaiAPI.health()          ← Health check
│
└── app.js (Main application)
    ├── Event listeners
    ├── Message handling
    ├── Dropdown logic
    ├── UI interactions
    └── Utility functions
```

---

### /docs/ (Documentation)

All documentation files:

| File | Purpose | Read When |
|------|---------|-----------|
| README.md | Quick start guide | First thing |
| START_HERE.txt | Friendly introduction | First time users |
| PROJECT_STRUCTURE.md | Folder organization | Understanding layout |
| MIGRATION.md | Migration from old system | Upgrading |
| IMPLEMENTATION_SUMMARY.md | Architecture details | Developers |
| DELIVERY_MANIFEST.md | File inventory | Complete overview |

---

## How to Use This Structure

### Development Workflow

```
1. Edit HTML
   → public/index.html (structure only)

2. Edit Styles
   → public/css/styles.css (all CSS)

3. Edit Frontend Logic
   → public/js/app.js (UI interactions)

4. Edit Backend Logic
   → utils/*.js (server-side code)

5. Run Server
   → npm start (runs server.js)

6. Test in Browser
   → http://localhost:3000
```

### Adding New Features

**Add a new API endpoint:**
1. Create function in `utils/newFeature.js`
2. Add route in `server.js`
3. Add API wrapper in `public/js/api.js`
4. Add UI/events in `public/js/app.js`
5. Add styles in `public/css/styles.css`

**Add new CSS:**
- Add to `public/css/styles.css`
- Reference classes in HTML

**Add new JavaScript:**
- Create in `public/js/` or `utils/`
- Import/require as needed

---

## File Sizes

| File | Size | Purpose |
|------|------|---------|
| server.js | 6.9 KB | Backend |
| utils/mpaiInstructions.js | 13 KB | MPAI framework |
| utils/claudeHandler.js | 3.6 KB | Claude API |
| utils/db.js | 3.9 KB | Database |
| public/index.html | ~3 KB | Clean HTML |
| public/css/styles.css | ~15 KB | All styles |
| public/js/api.js | 3.8 KB | API wrapper |
| public/js/app.js | ~8 KB | App logic |

**Total:** ~55 KB (extremely lightweight)

---

## File Organization Best Practices

### ✅ DO:
- Keep CSS in `css/` folder
- Keep JavaScript in `js/` folder  
- Keep backend logic in `utils/` folder
- Keep HTML clean and semantic
- Use external file references

### ❌ DON'T:
- Don't put CSS in HTML files
- Don't put JavaScript in HTML files
- Don't mix multiple concerns in one file
- Don't create files without clear purpose
- Don't clutter root directory

---

## Setup Checklist

After copying files to your project:

```powershell
# 1. Verify structure
#    ✅ server.js exists in root
#    ✅ utils/ folder with 3 files
#    ✅ public/ with index.html
#    ✅ public/css/ with styles.css
#    ✅ public/js/ with api.js and app.js

# 2. Install dependencies
npm install

# 3. Create .env
Copy-Item ".env.template" ".env"

# 4. Start server
npm start

# 5. Test in browser
#    http://localhost:3000
```

---

## Git Ignore

The `.gitignore` file should prevent these from being committed:

```
node_modules/
.env
.env.local
logs/
*.log
.DS_Store
.vscode/
.idea/
```

---

## Next Steps

1. **Review this structure** - understand where each file goes
2. **Copy files** - get all files into your project
3. **Follow setup** - npm install, configure .env
4. **Start server** - npm start
5. **Develop** - edit files in organized folders

Everything is now properly organized! 🎉
