# Auto-Correction System - GXCode 2026

## Overview

The Auto-Correction System automatically detects and fixes syntax errors in JavaScript/TypeScript files when they are saved. It works transparently in the background to improve code quality and prevent common mistakes.

## Features

### 1. **Real-time Syntax Validation**
- Validates JavaScript (.js, .jsx, .mjs) and TypeScript (.ts, .tsx) files
- Detects common syntax errors like:
  - Unbalanced braces `{}`
  - Duplicate closing braces `}}`
  - Missing brackets
  - Other syntax errors

### 2. **Automatic Fixing**
The system attempts to fix errors in two stages:

#### Stage 1: Rule-based Auto-Fix
- Automatically fixes common patterns like duplicate braces
- Fast and deterministic
- No AI required

#### Stage 2: AI-powered Fix
- If rule-based fixing fails, requests help from the local AI (Ollama)
- Uses your configured AI model (e.g., `qwen2.5-coder:7b`)
- More powerful but requires Ollama to be running

### 3. **Instant Editor Updates**
- When a file is auto-corrected, the editor immediately shows the fixed code
- No need to switch tabs or reload the file
- Visual notification confirms the correction

### 4. **Error Notifications**
- Success notification when files are auto-corrected
- Error notification when syntax errors can't be fixed
- Detailed error messages with line numbers

## How It Works

### File Save Flow

```
User saves file (Ctrl+S)
    ↓
fs-write-file handler intercepts
    ↓
SyntaxValidator checks for errors
    ↓
If errors found:
    ├─ Try rule-based auto-fix
    ├─ If successful → save fixed code
    └─ If failed → try AI fix (if Ollama available)
        ├─ If successful → save AI-fixed code
        └─ If failed → save original + notify user
    ↓
Editor updates with corrected content
    ↓
Toast notification shows result
```

## Components

### Backend (Node.js/Electron)

1. **Syntax Validator** (`src/main/services/syntaxValidator.js`)
   - Core validation logic
   - Rule-based auto-fixing
   - Error detection and reporting

2. **Auto-Correction Service** (`src/main/services/autoCorrectionService.js`)
   - Orchestrates validation and fixing
   - Manages AI integration
   - Tracks fix history and statistics

3. **FS Handlers** (`src/main/ipc/fsHandlers.js`)
   - Intercepts file write operations
   - Triggers auto-correction before saving
   - Sends events to frontend

### Frontend (React/Monaco Editor)

1. **Editor Integration** (`APP/core/editor.js`)
   - Handles save operations
   - Reloads corrected content
   - Shows notifications

2. **Event Listeners**
   - `onFileAutoCorrected` - Updates editor when backend fixes file
   - `onFileSaveError` - Shows error notifications

## Configuration

### Enable/Disable Auto-Correction

```javascript
// Enable
window.electronAPI.autoCorrectionSetEnabled(true);

// Disable
window.electronAPI.autoCorrectionSetEnabled(false);
```

### Get Status

```javascript
const status = await window.electronAPI.autoCorrectionGetStatus();
console.log(status);
// { enabled: true, maxRetries: 3 }
```

### Get Statistics

```javascript
const stats = await window.electronAPI.autoCorrectionGetStats(filePath);
console.log(stats);
// { totalAttempts: 5, successfulFixes: 4, failedFixes: 1, lastFixTimestamp: 1234567890 }
```

### Clear History

```javascript
// Clear history for specific file
await window.electronAPI.autoCorrectionClearHistory('/path/to/file.ts');

// Clear all history
await window.electronAPI.autoCorrectionClearHistory();
```

## Examples

### Example 1: Duplicate Closing Brace

**Before (with error):**
```typescript
test.describe('Test', () => {
    test('example', async ({ page }) => {
        await page.goto('https://example.com');
    });
});

}; // ← Extra closing brace
```

**After (auto-fixed):**
```typescript
test.describe('Test', () => {
    test('example', async ({ page }) => {
        await page.goto('https://example.com');
    });
});

; // ← Extra brace removed
```

### Example 2: Unclosed Brace

**Before (with error):**
```javascript
function hello() {
    console.log("Missing closing brace");
// Missing }
```

**After (AI-fixed):**
```javascript
function hello() {
    console.log("Missing closing brace");
}
```

## Testing

Run the test suite to verify auto-correction works:

```bash
node test_simple.js
```

Expected output:
```
=== TESTING BUG FROM SCREENSHOT ===

Original code has extra }; on last line

Validation result: INVALID
Errors found: 1
Error: Unexpected '}' without matching '{'
Line: 19

=== ATTEMPTING AUTO-FIX ===

Auto-fix successful: YES

Fixed code validation: ✅ VALID
```

## Troubleshooting

### Auto-correction not working

1. Check if auto-correction is enabled:
   ```javascript
   const status = await window.electronAPI.autoCorrectionGetStatus();
   console.log(status.enabled);
   ```

2. Check console logs for `[AUTO-CORRECTION]` messages

3. Verify Ollama is running for AI fixes:
   ```bash
   ollama list
   ```

### Editor not updating after fix

1. Check if `onFileAutoCorrected` event is being received
2. Verify the file is currently open in the editor
3. Check browser console for `[GX-EDITOR]` logs

### AI fix not working

1. Ensure Ollama is installed and running
2. Check if the configured model is available:
   ```bash
   ollama list
   ```

3. Verify model configuration in AI Companion settings

## Performance Considerations

- **Rule-based fixes**: < 100ms (instant)
- **AI fixes**: 5-30s (depends on model and hardware)
- **Validation**: Non-blocking, happens before file write
- **Editor updates**: Debounced to prevent flickering

## Future Improvements

- [ ] Support for more languages (Python, Java, etc.)
- [ ] Custom fix rules configuration
- [ ] Better AI prompt engineering
- [ ] Fix suggestions instead of auto-fix
- [ ] User approval before AI fixes
- [ ] Learn from user corrections

## Architecture

```
┌─────────────────┐
│   User saves    │
│     file        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  fs-write-file handler              │
│  (src/main/ipc/fsHandlers.js)       │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Auto-Correction Service            │
│  (src/main/services/                │
│   autoCorrectionService.js)         │
└────────┬────────────────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────────┐  ┌──────────────┐
│ Syntax   │  │ AI Engine    │
│ Validator│  │ (Ollama)     │
└────┬─────┘  └─────────────┘
     │               │
     └───────┬───────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Save corrected file                │
└────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Send event to frontend             │
│  (file-auto-corrected)              │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Update editor with fixed content   │
│  (APP/core/editor.js)               │
└─────────────────────────────────────┘
```

## License

Part of GXCode 2026 IDE
