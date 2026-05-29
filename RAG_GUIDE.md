# RAG Pipeline — Noob → Pro Guide

This is the companion guide to your refactored code. It walks the pipeline **stage by stage**, and for each one tells you three things:

- ✅ **What you already did** (and why it's a good choice)
- ⬆️ **How to improve it** (the next upgrade)
- 🔀 **Other options & when to pick them** (use-case driven)

---

## The new file layout

Your original 600-line `rag.py` is split by responsibility. Each stage now lives in its own file, so you can read or change one stage without scrolling past the others.

```
app/
├── core/
│   ├── config.py            # all env vars, constants, clients (Pinecone/Supabase/Redis)
│   └── llm.py               # shared LLM + the RAG prompt
├── services/
│   ├── ingestion.py         # STEP 1  load files & URLs  (+ loader registry)
│   ├── ingestion_worker.py  # the background job: load→chunk→embed→upsert
│   ├── retrieval.py         # STEPS 3-5 embed → retrieve → rerank → reorder
│   ├── generation.py        # STEP 6  build context + source citations
│   ├── cache.py             # semantic cache (in front of retrieval)
│   ├── evaluation.py        # STEP 7  precision / recall / hallucination judges
│   └── storage.py           # all Supabase reads/writes
├── utils/
│   └── chunking.py          # STEP 2  splitter factory (your bug fixed)
└── routers/
    ├── rag.py               # thin HTTP layer for ingest + query + stream
    └── chat.py              # thin HTTP layer for chat CRUD
```

**Guiding principle:** *routes are thin, services do the work.* A route should parse the request, call a service, and shape the response — nothing more. That's what makes the code testable and easy to follow.

---

## The pipeline at a glance

```
INGEST        CHUNK        EMBED         STORE
 (load)  →   (split)   →  (vectorize) → (Pinecone)
                                            │
                                            ▼
query ──► [semantic cache?] ──miss──► RETRIEVE ──► RERANK ──► REORDER ──► BUILD CONTEXT ──► LLM ──► answer
                │                     (hybrid)   (cross-enc) (lost-in-mid)                          │
                └── hit ──► replay cached answer                                      (optional) EVALUATE
```

---

## Step 1 — Ingestion (loading)

**Job:** turn a raw source into clean `Document` objects with metadata. No embedding yet.

✅ **What you did:** PDF (`PyPDFLoader`), `.txt` (`TextLoader`), and a custom BeautifulSoup URL loader that strips nav/footer/script noise. Solid, covers the common cases.

⬆️ **Improve it:**
- **Layout-aware PDF extraction** is the single biggest quality lever if your docs have tables/columns. `PyMuPDFLoader` (free, keeps more structure) → `UnstructuredPDFLoader` with `hi_res` (detects titles/tables) → cloud OCR (LlamaParse, Azure Doc Intelligence, AWS Textract) for scanned docs and invoices.
- **OCR fallback:** detect empty text from scanned PDFs and route to Tesseract or a cloud OCR.
- **Capture richer metadata now** (author, created_at, section heading). You can't filter or cite on metadata you never stored.

🔀 **Other options & when:**
| Source | Loader | Use when |
|---|---|---|
| `.docx` | `Docx2txtLoader` / Unstructured | Word docs |
| `.pptx` | `UnstructuredPowerPointLoader` | slide decks |
| `.csv` / `.xlsx` | `CSVLoader` / `UnstructuredExcelLoader` | tabular data, one row → one doc |
| `.md` / `.html` | `UnstructuredMarkdownLoader` / `BSHTMLLoader` | docs sites |
| source code | language-aware splitters | code search |
| JS-heavy web | Playwright loader | SPAs that need rendering |
| whole site | `SitemapLoader` / `RecursiveUrlLoader` / Firecrawl | crawl docs, not one page |
| audio/video | Whisper transcription | meetings, podcasts |

The refactor adds a **`SUPPORTED_FILE_TYPES` registry** — adding a new type is one row, no route changes.

---

## Step 2 — Chunking (splitting)

**Job:** cut documents into retrieval-sized pieces. Chunk size *is* answer granularity.

✅ **What you did:** a strategy factory with FIXED / RECURSIVE / SEMANTIC.

🐛 **Bug fixed:** your factory accepted a `SplitStrategy` enum but compared against raw strings (`== "recursive"`), so passing the enum member fell through to `None`. The refactor makes `SplitStrategy` a `str`-Enum and normalizes input, so **both** the enum and the string work.

🔀 **Which chunker, when:**
- **FIXED** — blind N-char cuts. Quick baseline; structureless text (logs, transcripts).
- **RECURSIVE** *(your default)* — splits on paragraph→sentence→word boundaries. The right default for ~90% of prose/PDFs.
- **SEMANTIC** — new chunk when meaning shifts. Topically clean chunks, but embeds during ingestion (slower/pricier). Good for multi-topic docs.

⬆️ **Advanced chunking (the "pro" tier you listed):**
- **Structure-aware** — split on real structure (Markdown headers, code functions, PDF sections); keeps tables/code intact and can attach the heading path to metadata. Use when docs have clear headings.
- **Parent–child (small-to-big)** — embed small chunks for *precise* matching, return the larger parent for *full* context. **Highest-ROI upgrade** when small chunks are too thin to answer from.
- **Late chunking** — embed the whole doc with a long-context model, then pool into chunk vectors, so each chunk "remembers" document context. Fixes "it rose 12%" with no antecedent. Use when docs are full of cross-references/pronouns.
- **Proposition / sentence-window** — index atomic facts/sentences, expand to neighbours at query time. Use for pinpoint factual recall.

---

## Step 3 — Embedding

**Job:** text → vector, so similar meaning ≈ nearby vectors.

✅ **What you did:** OpenAI dense + BM25 sparse = **hybrid**. Dense captures *meaning* ("car" ≈ "automobile"); sparse captures *exact keywords* ("error E-4021"). Strong modern choice.

⬆️ **Improve it:**
- Move to `text-embedding-3-small` (cheap) or `-3-large` (best); keep `EMBEDDING_DIM` in `config.py` in sync.
- **Fit BM25 on your own corpus** (`bm25_encoder.fit(texts)` then persist) instead of the MS-MARCO `.default()`. Keyword stats then match *your* vocabulary, not generic web text.

🔀 **Other options & when:**
- **Self-hosted** (BGE / GTE / E5 via HuggingFace) — no per-call cost, data stays in-house.
- **Domain-specific embeddings** — when general models confuse legal/medical/financial jargon.

---

## Step 4 — Retrieval

**Job:** given the query vector, fetch the top-k nearest chunks.

✅ **What you did:** `PineconeHybridSearchRetriever` (dense+sparse, `dotproduct`) **plus** metadata filtering by `doc_id` for scoped search. That covers two of the most valuable strategies already.

🔀 **Other strategies & when:**
| Strategy | Use when |
|---|---|
| Pure dense / **MMR** | conceptual Qs; MMR adds diversity so you don't get 5 near-duplicates |
| **Hybrid** *(yours)* | best general default — meaning **and** exact terms (IDs, codes, names) |
| **Metadata-filtered** *(yours)* | multi-tenant, "search only these files", date ranges |
| **Multi-query** *(you have it commented out)* | recall matters — LLM rewrites the question into several phrasings and unions results |
| **Self-query** | questions mixing semantics + structured filters ("invoices from 2023") |
| **Parent-document** | retrieve small, return big (pairs with parent-child chunking) |
| **HyDE / step-back / graph** | multi-hop reasoning, sparse corpora |

⬆️ **Quick win:** enable the multi-query retriever you already stubbed out — it's the cheapest recall boost when latency allows the extra LLM call.

---

## Step 5 — Re-ranking & ordering

**Job:** a slower, more accurate second pass over the fast retriever's candidates.

✅ **What you did:**
- **`CrossEncoderReranker`** (bge-reranker-base) reads (query, chunk) *together* and scores true relevance, keeping top-n. **This is the highest-ROI quality upgrade after hybrid search — keep it.** Bonus: it writes `relevance_score` into metadata, which you surface as citation **confidence**.
- **`LongContextReorder`** puts the strongest chunks at the **start and end** of context, mitigating the "lost in the middle" effect. Cheap, no model call — keep it.

🔀 **Reranking alternatives & when:**
- **Hosted rerankers** (Cohere / Jina / Voyage) — often stronger than bge-base, no GPU to manage (paid).
- **bge-reranker-large / v2-m3** — more accuracy, higher latency.
- **LLM-as-reranker** — most accurate, most expensive; reserve for low-volume, high-stakes queries.

📐 **Rule of thumb:** retrieve **wide** cheaply (top_k 20–50), rerank **down** to a few (top_n 3–8). Wide-retrieve-then-rerank beats narrow-retrieve every time. (Your `RETRIEVER_TOP_K` / `RERANK_TOP_N` are now config dials.)

---

## Step 6 — Context window management

**Job:** decide what actually goes into the prompt.

✅ **What you did:** dedup sources by chunk prefix; reorder for "lost in the middle".

⬆️ **Improve it (now centralized in `generation.build_context`):**
- **Token budgeting** — cap total context tokens; if the reranked set is too big, drop the lowest-scored chunks first (leaving room for the answer). Right now you concatenate everything — that's the obvious next addition.
- **Contextual compression** — `LLMChainExtractor` summarises/extracts only the relevant span of each chunk before sending. Saves tokens on long chunks.
- **Conversation history** — for multi-turn chat you must *also* budget prior turns: summarise old turns or keep a rolling window so history + context fit.

---

## Step 7 — Evaluation (optional)

**Job:** automatically score retrieval + answer quality.

✅ **What you did:** three LLM-as-judge metrics — `retrieval_precision`, `recall_score`, `hallucination_rate` — run **concurrently** with `asyncio.gather`. These map almost 1:1 to RAGAS's context-precision / context-recall / faithfulness.

⬆️ **Improve it:**
- Graduate to **RAGAS** or **DeepEval** for answer-relevance, semantic-similarity, and dataset-level aggregation.
- Build a small **human-labelled gold set** and measure against it — LLM judges are noisy and directional, not absolute.

---

## Cross-cutting: the semantic cache

✅ **What you did:** key on the query **embedding** (not the string), scoped per document-set, with a 0.95 cosine threshold and 24h TTL. Cache failures degrade gracefully to a miss — exactly right; a cache must never break a request.

⬆️ **Improve it:**
- The lookup brute-forces cosine over every key in a scope (**O(n)**). Fine for hundreds of entries. At scale, store cache embeddings in their own vector index (a Pinecone namespace or Redis Vector Search) and ANN-search them — or adopt **GPTCache**.
- Tune the threshold against real traffic: too low → false hits (wrong answers); too high → few hits.

---

## Production hardening (the last 20%)

- **Task queue** — replace FastAPI `BackgroundTasks` with **Celery / RQ / Arq** for retries, concurrency limits, and survival across restarts. The in-memory `INGESTION_JOBS` dict is per-process; with multiple replicas, treat the Supabase log as the source of truth (or move job state to Redis).
- **Idempotent ingestion** — hash file content and skip re-ingesting duplicates.
- **Observability** — trace retrieval + generation with LangSmith / Langfuse to see *why* an answer was bad.
- **Streaming evaluation** — you currently `await` evaluation before the final `done` frame; consider running it fully fire-and-forget so it never delays the stream close.

---

### TL;DR of what changed in the refactor

1. One 600-line file → **stage-per-file** modules with thin routers.
2. **Fixed the chunking enum bug** (enum members now work).
3. All tunables (`top_k`, `top_n`, models, cache threshold/TTL) → **`config.py` dials**.
4. **Loader registry** so new file types are one row.
5. Inline Supabase/cache/eval logic → **dedicated testable services**.
6. Heavy per-stage comments explaining *what you did / what to improve / what else exists*.
