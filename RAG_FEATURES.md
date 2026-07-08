# RAG Features & Frontend Integration Guide

What the "Ask your documents" (RAG) system does, and how the frontend talks to it.
All endpoints live under the `/rag` prefix and require a **Bearer auth token**.

---

## What it does (user-facing features)

| Feature | What the user sees | Backend |
|---|---|---|
| **Grounded answers** | Answers come from *their* uploaded documents, not the model's general knowledge. | retrieval + `RAG_ANSWER` prompt |
| **Inline citations** | Every claim is tagged `[1] [2]`, each mapping to a source passage with a confidence score. | `sources[]` + `citations` event |
| **Won't hallucinate** | If the docs don't cover the question, it clearly declines instead of inventing an answer. | grounding gate + refusal |
| **Private to each user** | A user's questions only ever search their own files. | per-user vector scoping |
| **Meaning + exact match** | Finds the right passage by concept *or* exact term (names, IDs, codes). | hybrid (dense + sparse) search |
| **Choose scope** | Search all documents, or narrow to specific ones. | `ingestions[]` in the request |
| **Fast, live answers** | Answers stream token-by-token; repeated questions return instantly. | SSE stream + semantic cache |
| **Best matches first** | Most relevant passages lead the answer. | re-ranking |
| **Saved conversations** | Chats persist and can be revisited. | `chat_id` + message history |
| **Multi-format upload** | PDF, text files, and web links. | ingestion pipeline |

---

## Endpoints

All requests send `Authorization: Bearer <token>`.

### Upload a document
`POST /rag/ingest/{action}` → **202 Accepted** (processes in the background)

- `action = "url"` → `multipart/form-data` with field `data` = JSON string `{"url": "https://..."}`
- `action = anything else` (e.g. `file`) → `multipart/form-data` with a `file` field (PDF or text)

**Response**
```json
{ "job_id": "e3b0c442-...", "status": "queued", "source": "React Native JD.pdf" }
```
Use `job_id` to poll status.

### Check ingestion status
`GET /rag/ingest/status/{job_id}`

```json
{ "status": "completed", "source": "React Native JD.pdf",
  "chunks": 4, "queued_at": "...", "completed_at": "..." }
```
`status` progresses: `queued → processing → completed` (or `failed`, with an `error` field).

### List a user's documents
`GET /rag/get-files`

```json
{ "message": "list fetched", "data": [ { "doc_id": "...", "source": "...",
  "file_type": "pdf", "status": "completed", "ingested_at": "..." } ] }
```

### Delete a document
`DELETE /rag/ingest/{doc_id}` → `{ "message": "ingestion deleted", "doc_id": "...", "vectors_deleted": 4 }`
(Only the owner can delete; a non-owner gets **404**.)

### Ask a question (non-streaming)
`POST /rag/query`

```json
// request body
{ "question": "What was Q3 revenue?",
  "ingestions": ["doc_id_1"],   // optional — omit/empty = all of the user's docs
  "evaluate": false,            // optional — include quality metrics in the response
  "chat_id": "abc"              // optional — omit to start a new chat
}
```
```json
// response
{ "answer": "Q3 revenue was $4.2M [2].",
  "sources": [ /* Source objects, see below */ ],
  "grounded": true,
  "evaluation": { /* only if evaluate:true — see below */ } }
```

### Ask a question (streaming) — **recommended for chat UI**
`POST /rag/query/stream` → `text/event-stream` (Server-Sent Events). Same request body as above.

---

## Streaming protocol (SSE)

Each event is a line `data: {json}\n\n`. Handle these `type`s in order of arrival:

| `type` | Payload | What the UI should do |
|---|---|---|
| `sources` | `{ sources: [...], cached?: true }` | Render the source list (so citations `[n]` resolve as tokens arrive). `cached:true` = served from cache. |
| `token` | `{ token: "text " }` | Append to the streaming answer bubble. |
| `citations` | `{ cited: [2, 4] }` | The source numbers the answer actually used — highlight/keep only these if desired. |
| `evaluation` | `{ evaluation: {...} }` | Only if `evaluate:true`. Optional quality panel. |
| `error` | `{ message: "..." }` | Show the message (e.g. *"No relevant documents found. Please upload documents first."*). Stop. |
| `done` | `{ chat_id: "...", grounded?: bool, cached?: bool }` | Finalize. Save `chat_id` for the next turn. |

**Refusal (the "won't hallucinate" case):** when the documents can't support an answer, the
stream emits `sources` with an empty list, a single `token` with the refusal message, then
`done` with `grounded: false`. Render it as a normal assistant message — it's a safe decline,
not an error.

---

## Data shapes

### Source object (in `sources[]` and the `sources` event)
```json
{
  "citation": 2,                       // the [n] used in the answer text
  "chunk_text": "Total revenue for the third quarter reached $4.2M ...",
  "source": "financials_q3.pdf",       // filename or URL
  "page_number": 3,                    // may be null (e.g. text files, URLs)
  "confidence_score": 0.19,            // re-ranker relevance, 0..1, may be null
  "doc_id": "0f70a54d-..."             // which uploaded document it came from
}
```
**Rendering citations:** the answer text contains inline markers like `[2]`. Map each `[n]` to
the `sources` item whose `citation === n`, and make it clickable to reveal `chunk_text` /
`source` / `page_number`.

### Evaluation object (only when `evaluate: true`)
```json
{ "retrieval_precision": 1.0,   // fraction of retrieved chunks judged relevant
  "recall_score": 0.8,          // how completely the context covered the answer
  "hallucination_rate": 0.0 }   // fraction of the answer NOT supported (0 = fully grounded)
```
These are LLM-judged and **noisy** — treat as directional signals, not exact truth.

---

## UI guidance

- **Prefer `/rag/query/stream`** for the chat experience; use `/rag/query` for one-shot calls.
- Show the **sources panel** as soon as the `sources` event arrives, before tokens finish.
- Render `[n]` markers as **clickable citation chips** → open the matching source's `chunk_text`.
- Treat a **refusal** (`grounded:false` with the decline message) as a normal, expected reply.
- Show upload progress by polling `GET /rag/ingest/status/{job_id}` until `completed`/`failed`.
- Pass the previous `chat_id` back on each turn to keep a conversation together.
- **Scope control:** let users pick documents → send their `doc_id`s as `ingestions`. Empty = all.
