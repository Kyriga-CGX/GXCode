# MCP Transport Configuration Guide

## Problema

Se ricevi questo errore:
```
Errore: 405 - {"jsonrpc":"2.0","error":{"code":-32600,"message":"The YouTrack MCP Server does not support SSE transport, which has been deprecated in the MCP specification. Please configure your MCP client to use HTTP Streamable transport."}}
```

## Causa

Il server MCP YouTrack che stai utilizzando sta cercando di usare il trasporto **SSE (Server-Sent Events)**, che è stato **deprecato** nella specifica MCP. I server MCP moderni ora richiedono il trasporto **HTTP Streamable**.

## Soluzione

### Opzione 1: Aggiornare il Server MCP YouTrack

Se hai accesso alla configurazione del server MCP YouTrack:

1. **Aggiorna il server MCP** all'ultima versione che supporta HTTP Streamable transport
2. **Modifica la configurazione** del server per usare HTTP Streamable invece di SSE

Esempio di configurazione corretta:
```json
{
  "mcpServers": {
    "youtrack": {
      "command": "npx",
      "args": ["-y", "@your-mcp-server/youtrack"],
      "transport": "http-streamable"  // <-- Usa questo invece di SSE
    }
  }
}
```

### Opzione 2: Usare la Configurazione YouTrack Standard (Raccomandato)

Invece di usare un server MCP YouTrack, puoi configurare YouTrack direttamente nelle impostazioni dell'IDE:

1. Apri **Impostazioni** → **YouTrack**
2. Inserisci l'**URL** del tuo server YouTrack
3. Inserisci il **Permanent Token**
4. Abilita la **Sincronizzazione**
5. Clicca **Test Connection** per verificare
6. Clicca **Salva e Sincronizza**

Questa configurazione usa l'API REST diretta di YouTrack ed è più stabile.

### Opzione 3: Rimuovere il Server MCP YouTrack

Se non stai usando attivamente il server MCP YouTrack:

1. Vai su **Impostazioni** → **MCP**
2. Trova il server YouTrack nella lista
3. Clicca sull'icona 🗑️ per rimuoverlo
4. L'errore scomparirà

## Come Ottenere un Permanent Token da YouTrack

1. Apri il tuo profilo su YouTrack
2. Vai su **Settings** → **Authentication**
3. Clicca **New Permanent Token**
4. Dai un nome al token (es. "GXCode IDE")
5. Copia il token (inizia con `perm:`)
6. Incollalo nelle impostazioni YouTrack di GXCode

## Risorse

- [Specifiche MCP - HTTP Streamable Transport](https://modelcontextprotocol.io/specification/2024-11-05/basic/transports#http-with-streamable-responses)
- [YouTrack API Documentation](https://www.jetbrains.com/help/youtrack/standalone/rest-api.html)
- [Come ottenere un Permanent Token](https://www.jetbrains.com/help/youtrack/standalone/user-profile.html#manage-permanent-token)

## Supporto

Se continui ad avere problemi:
1. Verifica di aver aggiornato all'ultima versione di GXCode IDE
2. Controlla la console per errori dettagliati
3. Segnala il problema su GitHub
