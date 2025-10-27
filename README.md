# Quick Start Guide - Multi-Perspective AI (MPAI)

## TL;DR - Get Running in 5 Minutes

```bash
# 1. Install dependencies
npm install

# 2. Setup .env
cp .env.template .env
# Edit .env and add:
# - CLAUDE_API_KEY=sk-ant-...
# - AWS_REGION=us-east-1
# - DYNAMO_TABLE=mpai-sessions

# 3. Start server
npm start

# 4. Open browser
# http://localhost:3000
```

---

## Project Structure

```
.
├── server.js                 # Express server (refactored)
├── package.json              # Dependencies
├── .env.template             # Environment variables template
├── MIGRATION.md              # Detailed migration guide
├── utils/
│   ├── mpaiInstructions.js   # MPAI system prompt & methods
│   ├── claudeHandler.js      # Claude API integration
│   └── db.js                 # DynamoDB persistence
└── public/
    ├── index.html            # Frontend UI
    └── js/
        └── api.js            # Client-side API wrapper
```

---

## Key Features

### ✅ 10 Analysis Methods
- **QUICK** - Fast insights (200-400 words)
- **FULL** - Comprehensive (600-800 words)
- **CONFLICT** - Resolve gridlock
- **STAKEHOLDER** - Multi-party analysis
- **PATTERN** - Recurring problems
- **SCENARIO_TEST** - Compare options
- **TIME_HORIZON** - Short vs long term
- **STANDARD** - Full spectrum analysis
- **WELL_BEING_CHECK** - Strength-focused
- **HUMAN_HARM_CHECK** - Risk assessment

### ✅ Perspective Visibility Toggle
- **Visible** - Show perspective names (THINKER, RELATIONAL, etc.)
- **Invisible** - Natural flow without labels

### ✅ Smart Routing
- Auto-suggests best method based on query
- Detects bandwidth (LOW/MEDIUM/HIGH)
- Adjusts output length appropriately

### ✅ Session Management
- Create multiple sessions
- Track all analyses per session
- Store preferences per session
- 90-day data retention (TTL)

---

## API Endpoints

### Analyze
```
POST /api/analyze
Body: {
  userQuery: string,
  method?: "QUICK" | "FULL" | "CONFLICT" | ... | "SYNTHESIS",
  perspectiveVisibility?: "visible" | "invisible",
  sessionId?: string
}
Returns: { success, analysisId, sessionId, response, usage }
```

### Get Sessions
```
GET /api/sessions
Returns: { success, count, sessions: [...] }
```

### Get Session Details
```
GET /api/session/:sessionId
Returns: { success, sessionId, analyses, count }
```

### Create Session
```
POST /api/session/new
Returns: { success, sessionId }
```

### Suggest Method
```
POST /api/method/suggest
Body: { userQuery: string }
Returns: { success, suggestedMethod, bandwidth }
```

### Save Preference
```
POST /api/preference
Body: { sessionId, preference, value }
Returns: { success, message }
```

### Health Check
```
GET /api/health
Returns: { status, timestamp }
```

---

## Frontend Usage

### Via UI
1. Go to http://localhost:3000
2. Click "Analysis Methods" dropdown
3. Select a method or let it auto-suggest
4. Type your query
5. Click Send or press Enter

### Via JavaScript
```javascript
// Single analysis
const result = await mpaiAPI.analyze(
  "My team is divided on strategy",
  "CONFLICT",
  "visible"
);

// Get session
const session = await mpaiAPI.getSession(sessionId);

// Save preference
await mpaiAPI.savePreference(sessionId, "perspective_visibility", "invisible");

// Get method suggestion
const suggestion = await mpaiAPI.suggestMethod("I need to choose between two paths");
```

---

## Database Schema

### DynamoDB Table: `mpai-sessions`

```
PK: USER#<userId>
SK: SESSION#<sessionId>#<analysisId>

Attributes:
  - timestamp: ISO string
  - method: QUICK | FULL | CONFLICT | etc.
  - user_query: string
  - perspective_visibility: visible | invisible
  - response: string (full Claude response)
  - ttl: unix timestamp (expires after 90 days)
```

**Queries:**
```javascript
// Get all user sessions
QueryExpression: "PK = :pk"

// Get analyses in a session
QueryExpression: "PK = :pk AND begins_with(SK, :skPrefix)"

// Get latest analysis
ScanIndexForward: false (newest first)
```

---

## Configuration

### .env Variables
```
NODE_ENV=development          # or 'production'
PORT=3000                     # Server port
CLAUDE_API_KEY=sk-ant-...     # From console.anthropic.com
AWS_REGION=us-east-1          # AWS region
DYNAMO_TABLE=mpai-sessions    # DynamoDB table name
DEBUG=false                   # Enable debug logging
```

### Claude Model
Default: `claude-sonnet-4-20250514` (recommended)

Other options:
- `claude-opus-4-20250514` (premium, higher cost)
- `claude-3-5-sonnet-20241022` (cheaper, lower quality)

---

## Method Selection Guide

| Situation | Suggested Method | Output |
|-----------|------------------|--------|
| Quick decision needed | QUICK | 200-400 words |
| Feeling stuck between options | CONFLICT | 300-500 words |
| Multiple stakeholders | STAKEHOLDER | 400-600 words |
| Problem keeps happening | PATTERN | 600-800 words |
| Comparing 2+ options | SCENARIO_TEST | 600-800 words |
| Short vs long term tradeoff | TIME_HORIZON | 600-800 words |
| Comprehensive analysis needed | STANDARD | 800-1200 words |
| Focus on growth | WELL_BEING_CHECK | 800-1200 words |
| Safety concerns | HUMAN_HARM_CHECK | 800-1200 words |
| Integration after multiple analyses | SYNTHESIS | 800-1500 words |

---

## Testing

### 1. Health Check
```bash
curl http://localhost:3000/api/health
```

### 2. Test Analysis
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "userQuery": "I struggle with work-life balance",
    "method": "QUICK"
  }'
```

### 3. Check Sessions
```bash
curl http://localhost:3000/api/sessions
```

---

## Troubleshooting

### Server won't start
```bash
# Check if port is in use
lsof -i :3000

# Or use different port
PORT=3001 npm start
```

### Claude API errors
```
"Invalid API key"
→ Check CLAUDE_API_KEY in .env

"Rate limited"
→ Implement retry logic or upgrade plan

"Model not found"
→ Check model string (use claude-sonnet-4-20250514)
```

### DynamoDB errors
```
"ValidationException"
→ Check table exists: aws dynamodb describe-table --table-name mpai-sessions

"ProvisionedThroughputExceededException"
→ Use PAY_PER_REQUEST instead of provisioned capacity
```

---

## Development Tips

### Enable Debug Logging
```bash
DEBUG=true npm start
```

### Local Testing with curl
```bash
# Test with different methods
for method in QUICK FULL CONFLICT STANDARD SYNTHESIS; do
  curl -X POST http://localhost:3000/api/analyze \
    -H "Content-Type: application/json" \
    -d "{\"userQuery\":\"Test\",\"method\":\"$method\"}"
done
```

### Monitor DynamoDB
```bash
# Scan all items (for testing)
aws dynamodb scan --table-name mpai-sessions --region us-east-1

# Query specific user
aws dynamodb query \
  --table-name mpai-sessions \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values "{\":pk\":{\"S\":\"USER#user-1\"}}" \
  --region us-east-1
```

---

## Performance Notes

- **Response Time**: 2-5 seconds typical (Claude Sonnet 4.5)
- **Cost per Analysis**: ~$0.02 (with token optimization)
- **Concurrent Users**: AWS handles auto-scaling for DynamoDB
- **Data Retention**: 90 days (configurable via TTL)

---

## Next Steps

1. **Production Deployment**
   - Setup user authentication (replace `userId: 'user-1'`)
   - Configure CORS properly
   - Use environment-specific configs

2. **Enhanced Features**
   - Add conversation context tracking
   - Implement feedback rating system
   - Build analytics dashboard
   - Add export functionality (PDF/JSON)

3. **Optimization**
   - Implement response caching
   - Add request queuing for rate limiting
   - Setup error monitoring
   - Add observability/logging

---

## Support & Resources

- **MPAI Instructions**: See `utils/mpaiInstructions.js`
- **Migration Details**: See `MIGRATION.md`
- **Claude Docs**: https://docs.claude.com
- **AWS DynamoDB**: https://docs.aws.amazon.com/dynamodb

---

**Ready to go!** Start the server and visit http://localhost:3000 to see MPAI in action. 🚀
