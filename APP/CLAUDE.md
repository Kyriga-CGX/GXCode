# HTTPS://GITHUB.COM/KYRIGA-CGX/GXCODE.GIT - PROJECT CONTEXT

This project is being managed by **GXCode IDE**.

## PROJECT IDENTITY
- **Remote/ID**: `https://github.com/Kyriga-CGX/GXCode.git`
- **Local Root**: `.` (Current Working Directory)

## IDE RESOURCES (GLOBAL)
- **Agents Location**: `~/.GXCODE/agents`
- **Skills Location**: `~/.GXCODE/skills`

## CURRENT WORKSPACE CONTEXT
- **Root Path**: C:\Users\Kyrig\OneDrive\Desktop\GXCODE\APP
- **Open Editor Tabs**:
  - `C:/Users/Kyrig/OneDrive/Desktop/GXCODE/regex2.json` 
  - `C:/Users/Kyrig/OneDrive/Desktop/GXCODE/regex.json` 
  - `C:/Users/Kyrig/OneDrive/Desktop/prova/CLAUDE.md` 
  - `C:/Users/Kyrig/OneDrive/Desktop/prova/nuovo_file.js` 
  - `C:/Users/Kyrig/OneDrive/Desktop/prova/nuodfgvo_file.js` 
  - `C:/Users/Kyrig/OneDrive/Desktop/prova/nuova_cartella/CLAUDE.md` **[ACTIVE]**


## INSTRUCTIONS
1. When the user asks about agents or skills, prioritize looking into the Global locations (relative to User Home).
2. You have full access to the project root for searching and editing code.
3. Use the open editor tabs as your primary context for what the user is currently working on.

## MODEL SELECTION STRATEGY
Per ottimizzare costi e prestazioni, Claude deve seguire queste linee guida nella scelta del modello:
- **Claude 3 Haiku**: Analisi di file esistenti, analisi del brief di progetto (es: `Brief Analyzer`) e compiti di sola lettura.
- **Claude 3.5 Sonnet**: Generazione di nuovo codice, creazione di layout e documenti (es: `UI Copy Generator`, `Layout Architect`), applicazione di modifiche e refactoring.
- **Claude 3 Opus**: Gestione di agenti complessi, delega di compiti a skill esterne e creazione/orchestrazione di sotto-agenti specializzati.
