# Q-CreditX — Stage 1 Foundation

Fresh project (only template placeholder), so everything is built new, following the uploaded brief.

## What gets built
- **Baby-pink design system** with the exact palette from the brief, 16px rounded cards, soft shadows, refined fonts.
- **Custom logo** (quantum orbit + banking stack, dark pink/white) generated as an image.
- **Collapsible sidebar** (Home, Dashboard, Projects, CudaQ, Q-Circuits, LQM) with icon-only mode and tooltips; mobile drawer.
- **Top bar**: logo, title + "Quantum Credit Risk Analysis", search, notifications, MB avatar, menu button.
- **Home**: hero with CTA "Run Analysis", generated quantum-chip illustration, 4 KPI cards computed live from the portfolio (Exposure, EL; VaR and ECR shown from Monte Carlo when run, labelled "Demonstration data").
- **Dashboard (Portfolio Manager)**: table of 100 deterministic synthetic assets; add/edit/delete, search, status filter, column sort, pagination, CSV upload with row-level validation report, sample CSV download. Validation: PD/LGD/rho in [0,1], exposure > 0, unique IDs.
- **Analysis configuration panel**: portfolio, model (Independent / Gaussian conditional independence), confidence (95/99/99.9%), sample count, 1-year horizon, algorithm (Classical active; Quantum marked "Planned – Stage 3"). Run Analysis computes EL exactly plus classical Monte Carlo loss distribution (Recharts histogram), VaR and ECR — real calculations, no quantum claims.
- **Projects**: create, list, open (loads its portfolio/config), delete; shows last analysis status.
- **CudaQ, Q-Circuits, LQM**: informative pages — simulator status "Not connected", U/S/C operators + QAE workflow from Egger et al., and LQM explanations; pending items clearly labelled.
- Toasts, empty states, loading states throughout.

## Data storage
Portfolios, assets and projects saved in Lovable Cloud database (seeded with the 100 demo assets), so CRUD persists across reloads. No login in Stage 1 (single shared demo workspace) unless you want it.

## Technical details
- Layers: `src/lib/risk/` (pure math: Phi, inverse Phi via Acklam + refinement, conditional PD with boundary clamps, seeded PRNG, Monte Carlo), `src/services/` (portfolio, analysis, projects via server functions), `src/components/`, one route file per nav item.
- Vitest tests for EL formula, conditional PD boundaries, validation rules, deterministic dataset.
- Playwright check of every route, CRUD, and console errors after build.

## Pending for Stage 2+
Quantum circuit construction (U, S, C), QAE execution via CUDA-Q, quantum vs classical comparison.
