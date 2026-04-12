# AI Companion Policy Update - Solo Intervento su Idle

## Problema Risolto ✅

**Prima**: L'AI validava e correggeva il codice **mentre scrivevi**, causando:
- ❌ Codice cancellato o modificato durante la digitazione
- ❌ Auto-save triggerava validazione aggressiva
- ❌ Interruzione del flusso di lavoro
- ❌ Frammenti di codice incompleto venivano "corretti" erroneamente

**Adesso**: L'AI interviene **SOLO** quando:
1. ✅ Premi `Ctrl+S` (salvataggio manuale)
2. ✅ Sei in idle da 5 secondi (hai smesso di scrivere)

---

## Nuova Policy di Validazione

### 🟢 QUANDO l'AI INTERVIENE:

| Trigger | Validazione | Auto-Correction | Note |
|---------|-------------|-----------------|------|
| **Ctrl+S** (manual save) | ✅ SÌ | ✅ SÌ | Validazione completa |
| **Idle 5s** (smetti di scrivere) | ✅ SÌ | ✅ SÌ | Solo se sei fermo da 5s |
| **Auto-save** (mentre scrivi) | ❌ NO |  NO | **Nessun intervento** |
| **Digitazione** | ❌ NO | ❌ NO | **Nessun intervento** |

---

## Come Funziona

### 1. Mentre Scrivi ✍️
```
Utente digita codice
    ↓
Auto-save ogni 2s
    ↓
[NESSUNA VALIDAZIONE] ← AI sta zitta
    ↓
Codice salvato così com'è
```

**Nessun intervento dell'AI** - puoi scrivere codice incompleto senza problemi.

---

### 2. Quando Vai in Idle (5 secondi) 🤔
```
Utente smette di scrivere
    ↓
Timer 5 secondi parte
    ↓
Se ancora idle dopo 5s:
    ├─ 🤔 Slime mette mani sul mento
    ├─ Validazione codice
    ├─ Se trova errori → auto-fix
    ├─ 🎉 Slime salta (se ha corretto)
    └─ Toast notifica
```

**Solo dopo 5 secondi di inattività** l'AI controlla il codice.

---

### 3. Quando Premi Ctrl+S 💾
```
Utente preme Ctrl+S
    ↓
🤔 Slime mette mani sul mento
    ↓
Validazione immediata
    ↓
Se trova errori:
    ├─ Tenta auto-fix
    ├─ O chiede all'AI
    ├─ ✅ Se corregge → aggiorna editor subito
    └─ 🎉 Slime eccitato
```

**Validazione completa** solo su salvataggio manuale.

---

## Safety Checks Aggiuntivi

### 🛡️ Protezione Codice

1. **Mai scrivere contenuto vuoto**
   - Se il codice è vuoto → **RIFIUTATO**
   - Messaggio: "Scrittura rifiutata: il contenuto è vuoto"

2. **Protezione da riduzione significativa**
   - Se il file perde >50% delle righe → **WARNING**
   - Toast: "Attenzione: il file sta diminuendo"
   - Tu decidi se procedere

3. **Auto-save bypassa validazione**
   - Durante la scrittura: **NESSUN controllo**
   - Solo salva così com'è

---

## Timeline Tipica

```
15:00:00 - Inizi a scrivere codice
15:00:02 - Auto-save (nessuna validazione) ✅
15:00:04 - Auto-save (nessuna validazione) ✅
15:00:06 - Auto-save (nessuna validazione) ✅
15:00:08 - Smetti di scrivere
15:00:13 - ⏰ 5 secondi idle trascorsi
15:00:13 - 🤔 AI valida il codice
15:00:14 - 🎉 AI corregge errori (se presenti)
15:00:14 - ✅ Toast: "Codice corretto durante l'idle"
```

---

## Configurazione

### Disabilitare Idle Validation

Se vuoi disabilitare la validazione in idle:

```javascript
// Nella console del browser
localStorage.setItem('gx-idle-validation', 'false');
```

### Cambiare Timeout Idle

Default: 5 secondi. Puoi modificarlo:

```javascript
// 10 secondi invece di 5
localStorage.setItem('gx-idle-validation-timeout', '10000');
```

---

## Log di Sistema

### Durante la scrittura:
```
[AUTO-SAVE] Skipping validation (user is typing): file.js
[AI-REACTIVITY] User is typing - skipping validation
```

### Dopo idle:
```
[IDLE-VALIDATION] User has been idle - running validation...
[IDLE-VALIDATION] Editor updated with idle corrections
```

### Su Ctrl+S:
```
[AUTO-CORRECTION] Validating: file.js
[AUTO-CORRECTION] ✅ Auto-fixed 1 error(s)
```

---

## Flusso Completo

```
┌─────────────────────────────────────┐
│  Utente scrive codice               │
│  (nessun intervento AI)             │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
   Auto-save       Ctrl+S
   (ogni 2s)     (manuale)
        │             │
        │             ▼
        │      ┌──────────────┐
        │      │ 🤔 Valida    │
        │      │ 🔧 Correggi  │
        │      │ 💾 Salva     │
        │      └──────────────┘
        │
        ▼
   Smetti di
   scrivere
        │
        ▼ (dopo 5s)
   ┌──────────────┐
   │ 🤔 Valida    │
   │ 🔧 Correggi  │
   │ 💾 Salva     │
   └──────────────┘
```

---

## Vantaggi

✅ **Non interrompe il flusso** - Scrivi senza preoccupazioni
✅ **AI non interferisce** - Solo quando hai finito
✅ **Protezione dati** - Mai perde codice
✅ **Smart timing** - Aspetta che tu sia pronto
✅ **Controllo totale** - Ctrl+S quando vuoi tu

---

## Test

### Test 1: Scrittura continua
1. Scrivi codice per 10 secondi
2. Auto-save triggera 5 volte
3. ✅ **Nessuna validazione** durante la scrittura
4. Log: `[AUTO-SAVE] Skipping validation (user is typing)`

### Test 2: Idle trigger
1. Scrivi codice
2. Smetti di scrivere
3. Aspetta 5 secondi
4. ✅ **Validazione parte automaticamente**
5. Log: `[IDLE-VALIDATION] User has been idle`

### Test 3: Manual save
1. Scrivi codice incompleto
2. Premi Ctrl+S
3. ✅ **Validazione immediata**
4. Se ci sono errori → auto-correction
5. Editor si aggiorna subito

---

## Riepilogo Policy

| Azione | AI Interviene? | Quando? |
|--------|----------------|---------|
| Scrivere codice | ❌ **NO** | Mai |
| Auto-save | ❌ **NO** | Mai |
| Idle 5 secondi | ✅ **SÌ** | Dopo inattività |
| Ctrl+S | ✅ **SÌ** | Immediato |
| Cambio file | ⚠️ **Parziale** | Solo warming, no fix |

**Regola d'oro**: L'AI **mai** ti interrompe mentre scrivi. Solo quando **tu** decidi (Ctrl+S) o quando sei **in pausa** (idle 5s).
