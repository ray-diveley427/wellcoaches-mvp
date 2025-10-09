# Wellcoaches MVP — Implementation & Architecture Log

---

## Project Overview

The **Wellcoaches MVP** is an AI-powered platform designed to help users explore situations and challenges through the lens of the **Nine Perspectives** framework, blending cognitive science, coaching psychology, and generative AI. The MVP demonstrates how AI can simulate multidimensional coaching reflection — combining reasoning, emotion, and systems thinking — to produce balanced, human-like insights.

### **Primary Goals**

- Provide a conversational interface where users input real-life challenges.
- Generate nine distinct cognitive perspectives using OpenAI.
- Integrate a Core Observer layer to identify patterns across perspectives.
- Deliver a synthesized, psychologically aware response through Anthropic Claude.
- Maintain modularity and scalability for future expansion (e.g., visualization, persistence, privacy compliance, HIPAA readiness).

---

## Version: 2025-10-08

### Update: Core Observer Layer Integration  
### Update: User State Persistence (MVP Implementation)

---

## 🧭 System Architecture Diagram

```mermaid
flowchart TD
    A[🧑 User Input<br>Prompt / Question] --> B[🤖 OpenAI (GPT-5-mini)<br>Generate 9 Perspectives JSON]
    B --> C[👁️ Core Observer<br>Analyze Overlaps, Tensions, Missing Voices]
    C --> D[🧠 Anthropic Claude 3.5 Haiku<br>Synthesize Integrated Reflection]
    D --> E[🗂️ SQL Server (MMPlus)<br>Persist Session Data<br>Table: dbo.session_history]
    E --> F[💻 Web UI<br>Display Synthesis + Explore Missing Voices]

    subgraph AI_Stack [AI & Analysis Layer]
    B
    C
    D
    end

    subgraph Data_Stack [Persistence Layer]
    E
    end

    subgraph Frontend [Presentation Layer]
    F
    end

    style A fill:#E3F2FD,stroke:#64B5F6,stroke-width:2px
    style B fill:#E8F5E9,stroke:#81C784,stroke-width:2px
    style C fill:#FFF9C4,stroke:#FBC02D,stroke-width:2px
    style D fill:#EDE7F6,stroke:#7E57C2,stroke-width:2px
    style E fill:#F3E5F5,stroke:#BA68C8,stroke-width:2px
    style F fill:#FFF3E0,stroke:#FFB74D,stroke-width:2px
```

---

## 🧠 High-Level Architecture Flow

```
User Input
   ↓
GPT (OpenAI)
   → Generates 9 cognitive perspectives in JSON format
   ↓
Core Observer (OpenAI)
   → Analyzes relationships between perspectives
   → Identifies overlaps, tensions, and missing voices
   ↓
Claude (Anthropic)
   → Synthesizes final integrated response
   ↓
Database (SQL Server)
   → Persists prompt, perspectives, observer summary, synthesis
   ↓
Web UI (HTML)
   → Displays synthesis, missing voices, and optional observer summary
```

---

## ⚙️ Core Components

| Component                    | Description                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **server.js**                | Main Express app. Routes `/ask` and `/expand`. Orchestrates GPT perspective generation, Core Observer analysis, and Claude synthesis.      |
| **utils/buildPrompt.js**     | Builds the base GPT prompt for perspective generation.                                                                                     |
| **utils/synthesisPrompt.js** | Creates the synthesis prompt (updated to include Core Observer context).                                                                   |
| **utils/coreObserver.js**    | Implements the Core Observer logic — identifies overlaps, tensions, missing voices, and meta-themes.                                       |
| **utils/parseResponse.js**   | Parses and sanitizes GPT JSON output before synthesis.                                                                                     |
| **utils/getContext.js**      | Retrieves contextual material from vector stores or book sources if enabled.                                                               |
| **utils/db.js**              | 🆕 Handles SQL Server connection and inserts session data.                                                                                 |
| **views/result.html**        | Displays the results, perspectives, and exploration options.                                                                               |
| **public/styles.css**        | Defines the MVP’s front-end look and feel.                                                                                                 |

---

## 🪴 Core Observer Layer (Added in This Version)

### **Purpose**  
Acts as a meta-cognitive “observer” that watches all nine perspectives and identifies how they interrelate.

### **Functionality**
- Analyzes for:
  - **Overlaps** — shared ideas or themes.
  - **Tensions** — conflicting recommendations.
  - **Missing Voices** — absent or underrepresented perspectives.
  - **Meta-Themes** — higher-order insights that unify the perspectives.
- Produces structured JSON output with these categories.

### **Implementation Details**
- New file: `utils/coreObserver.js`
- `server.js` updated to call `analyzePerspectives()` and pass `observerSummary` to `synthesisPrompt()`
- `synthesisPrompt.js` updated to include observer context.

### **Verification**
Console output should include:
```
👁️ Running Core Observer analysis...
✅ Core Observer summary generated: { overlaps: [...], tensions: [...], ... }
```

---

## 🧱 User State Persistence (MVP Implementation)

### **Purpose**
Store all user interactions (prompt, perspectives, observer summary, synthesis) for future analysis and refinement of coaching models.

### **Stack Components**
- **Database:** Microsoft SQL Server (`MMPlus`)
- **Table:** `dbo.session_history`
- **User:** `wellcoaches_mvp` (restricted permissions)
- **Driver:** `mssql` (Node.js)
- **Environment Variables:**
  - `DB_SERVER`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`

### **Workflow**
1. User submits a prompt via `/ask`.  
2. GPT generates JSON with nine perspectives.  
3. Core Observer analyzes them.  
4. Claude synthesizes the final response.  
5. Session saved to `session_history` with:
   - `prompt`
   - `perspectives`
   - `observer_summary`
   - `synthesis`
   - `created_at`
6. Console confirms:
   ```
   🗂️ Session saved successfully.
   ```

### **Security & Compliance**
- `.env` used for credentials (not in version control).  
- No PII or identifiable user data stored.  
- SQL user has limited `SELECT`, `INSERT`, `UPDATE`, `DELETE` permissions.  
- Prepared statements prevent SQL injection.

### **Testing**
- `test-db.js` validated connection.  
- `test-insert.js` confirmed successful inserts.  
- Verified with:
  ```sql
  SELECT TOP 5 * FROM dbo.session_history ORDER BY id DESC;
  ```

---

## 📈 Next Steps (Future Layers)

| Planned Component               | Purpose                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| **Core Observer Visualization** | Front-end rendering of observer summary for transparency and insight mapping.      |
| **Core Mind Feedback Loop**     | Allow synthesis layer to feed back into Core Observer for iterative improvement.   |
| **Session Retrieval (Internal)**| Add `/history` route for testing and review of stored sessions.                    |
| **Privacy & Compliance Layer**  | Add anonymization and audit controls for HIPAA-readiness in full product build.    |
