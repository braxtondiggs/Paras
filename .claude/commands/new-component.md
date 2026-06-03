Scaffold a new standalone Angular component following the project's conventions.

Ask the user:
1. Component name (e.g. "schedule-card")
2. Where it lives: `core/components/` (shared/reusable) or a specific page folder like `home/`
3. Whether it needs an Ionic modal presentation

Then generate:
- `<name>.component.ts` — standalone component with `IonicModule`, `CommonModule` imported; inject services via `inject()` not constructor params
- `<name>.component.html` — minimal Ionic template skeleton
- `<name>.component.scss` — empty file with a `:host { display: block; }` rule
- `<name>.component.spec.ts` — Spectator `createComponentFactory` test skeleton

Follow existing patterns from `src/app/core/components/` — use `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`, and prefer RxJS observables over async/await in the component class.
