# GXCODE SYSTEM IDENTITY

Questo file aiuta l'AI a capire i limiti e i poteri del sistema GXCode.

## GX-SKILLS (TOOLING)
### Brief Analyzer
- **Descrizione**: Analizza il brief del sito, estrae obiettivi, target, tono, vincoli e segnala eventuali informazioni mancanti prima della progettazione del mockup.
- **Invocazione**: `gx-skill run "Brief Analyzer"`

### Creative Direction Builder
- **Descrizione**: Definisce la direzione visiva del mockup: mood, palette, tipografia, stile UI e tone of voice, coerenti con brand, target e obiettivo.
- **Invocazione**: `gx-skill run "Creative Direction Builder"`

### LangChain Core
- **Descrizione**: Core framework for developing applications powered by language models.
- **Invocazione**: `gx-skill run "LangChain Core"`

### Layout Architect
- **Descrizione**: Progetta la struttura della pagina e organizza le sezioni del mockup in un ordine strategico, in base a obiettivo, contenuti e tipo di sito.
- **Invocazione**: `gx-skill run "Layout Architect"`

### Responsive Mockup Planner
- **Descrizione**: Adatta il mockup alla visualizzazione mobile e tablet, definendo il comportamento responsive delle sezioni e la priorità dei contenuti.
- **Invocazione**: `gx-skill run "Responsive Mockup Planner"`

### UI Copy Generator
- **Descrizione**: Genera headline, subheadline, CTA, microcopy e testi chiave del mockup, mantenendo coerenza con target, prodotto e tone of voice.
- **Invocazione**: `gx-skill run "UI Copy Generator"`

### Wireframe Writer
- **Descrizione**: Converte la struttura del sito in un wireframe testuale dettagliato, descrivendo il layout di ogni sezione in modo chiaro per designer e sviluppatori.
- **Invocazione**: `gx-skill run "Wireframe Writer"`

### MODEL SELECTION STRATEGIES
Per massimizzare l'efficienza architettonica:
- **Analisi (Haiku)**: Utilizzato per `Brief Analyzer` e scansione iniziale dei file.
- **Generazione & Editing (Sonnet)**: Utilizzato per tutte le altre skill di progettazione e per la scrittura di codice/documentazione.
- **Orchestrazione (Opus)**: Utilizzato per il coordinamento tra agenti, la delega di skill a entità esterne e la generazione dinamica di nuovi sotto-agenti se necessario.

## ACTIVE AGENTS
- **DeepNLP Architect**: Assistant
- **Mockup Master Architect**: general
