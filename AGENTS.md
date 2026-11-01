<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Risk math lives in `src/lib/risk/` as pure functions (no React/DB) so it stays unit-testable; UI must never hardcode KPI values.
- Data access goes through `src/services/*` using the browser database client; Stage 1 is a shared demo workspace with open RLS (no login) — add auth before real data.
- Quantum engine lives in `src/lib/quantum/` (gate IR, own exact statevector simulator, U/S/C oracle, canonical QAE, VaR bisection) because Python/Qiskit cannot run in this stack; label it as the in-browser statevector simulator, never as Qiskit Aer, CUDA-Q or hardware, and never fill quantum outputs with classical numbers.
- Quantum jobs run in a Web Worker (`src/lib/quantum/worker.ts`) so long simulations never block the UI; saved runs omit QASM (regenerable).
- Monte Carlo runs in the browser (`src/lib/risk/monte-carlo.ts`, chunked with one seeded RNG stream) instead of a Python/FastAPI service, because the stack is TanStack Start on edge workers. Only aggregated histogram/CDF summaries are saved to history; raw scenario losses stay in memory for CSV export.
- Classical-vs-quantum comparisons (`src/lib/compare.ts`) always run Monte Carlo, exact enumeration and QAE on the same reduced quantum problem in loss units, so the numbers are like-for-like; full-portfolio Monte Carlo stays separate and is never set beside quantum VaR as if equivalent.
