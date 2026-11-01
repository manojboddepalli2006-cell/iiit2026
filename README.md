# Q-CreditX — Quantum Credit Risk Analysis (research prototype)

Implements the methodology of Egger, García Gutiérrez, Mestre & Woerner, *Credit Risk Analysis using Quantum Computers* (IBM Research, 2019): classical Monte Carlo, exact enumeration, and a gate-level quantum oracle A = C·S·U with canonical Quantum Amplitude Estimation and bisection VaR.

## Architecture

| Layer | Technology | Where |
|---|---|---|
| Frontend + server routes | TanStack Start (React 19, Vite 7), edge-worker runtime | `src/routes`, `src/components` |
| Classical risk engine | TypeScript, pure functions | `src/lib/risk` |
| Quantum engine | TypeScript gate IR + statevector simulator (≤ 20 qubits), runs in a Web Worker | `src/lib/quantum` |
| Comparison / reports | TypeScript, jsPDF | `src/lib/compare.ts`, `src/lib/report-full.ts` |
| Database | Lovable Cloud (Postgres) — portfolios, assets, projects, analyses, quantum_runs, comparisons | `drizzle/migrations` |
| Health check | `GET /api/public/health` → app + database status (200 / 503) | `src/routes/api/public/health.ts` |

**There is no Python backend.** Qiskit / Qiskit Aer cannot run in this stack, so `requirements.txt` is intentionally absent. Quantum circuits are simulated in the browser and can be exported as OpenQASM 3 (Q-Circuits page) to run in Qiskit externally:

```python
from qiskit import qasm3; from qiskit_aer import AerSimulator
qc = qasm3.loads(open("qae.qasm").read()); print(AerSimulator().run(qc, shots=1000).result().get_counts())
```

## Local development

```sh
bun install            # lockfile: bun.lock
cp .env.example .env   # fill in publishable values
bun run dev            # http://localhost:8080
bunx vitest run        # risk, quantum, comparison and routing tests
```

## Deployment

- **Frontend + server routes:** Publish from the Lovable editor (or self-host the TanStack Start build on Cloudflare Workers).
- **Database:** managed by Lovable Cloud; schema changes live in `drizzle/migrations`.
- **Environment variables:** see `.env.example`; only publishable keys are used. No secrets are required.
- **API URL / CORS:** the app calls its own origin and the database directly; no cross-origin API is exposed besides the read-only health endpoint.
- **Monitoring:** poll `/api/public/health`.

## Demo

Open **Demo** in the sidebar and press *Run all steps* — runs the IBM two-asset example live through Monte Carlo, circuit build, QAE, CDF, VaR, ECR, comparison and PDF export.

## Limitations

Synthetic data; shared demo workspace without sign-in; small quantum problems only; simulator timings imply no quantum speed-up.
