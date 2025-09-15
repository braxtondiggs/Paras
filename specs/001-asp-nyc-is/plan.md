# Implementation Plan: NYC Alternate Side Parking Tracking System

**Branch**: `001-asp-nyc-is` | **Date**: 2025-09-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-asp-nyc-is/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement a NYC alternate side parking tracking system that provides real-time updates, notifications, and schedule management for NYC residents to avoid parking tickets. The system will track ASP rules, suspensions, and changes using Angular 20 with Ionic 8 for mobile UI, Firebase/Firestore for backend, and Capacitor for native functionality.

## Technical Context
**Language/Version**: TypeScript with Angular 20.1.8 and Ionic 8.7.3
**Primary Dependencies**: Angular Fire 20.0.1, Capacitor 7.4.3, RxJS 7.8.1, Day.js 1.11.14
**Storage**: Firebase/Firestore for real-time data storage and synchronization
**Testing**: Jest 29.5.0 with Angular preset, @ngneat/spectator 21.0.1 for component testing
**Target Platform**: iOS and Android mobile applications via Capacitor
**Project Type**: mobile - Angular/Ionic mobile app with Firebase backend
**Performance Goals**: <3 second app load time, real-time data updates, minimal battery usage
**Constraints**: offline capability for cached data, push notification reliability, WCAG 2.1 accessibility
**Scale/Scope**: NYC resident user base, real-time parking data processing, multi-location tracking per user

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**User-Centric Design**:
- Solves real NYC resident parking problem? ✅ (avoiding parking tickets)
- Mobile-first approach? ✅ (Angular/Ionic for mobile)
- Accessible and performant? ✅ (WCAG 2.1, <3s load time)
- Reliable for urgent situations? ✅ (real-time updates, offline capability)

**Mobile-First Performance**:
- <3 second load requirement? ✅ (specified in constraints)
- Offline functionality? ✅ (cached data for offline viewing)
- Bundle size monitoring? ✅ (Angular build optimization)
- Battery usage minimal? ✅ (efficient background processing)

**Data Accuracy (NON-NEGOTIABLE)**:
- Real-time parking data? ✅ (Firebase real-time updates)
- Verified data sources? ✅ (NYC official data integration)
- Comprehensive error handling? ✅ (offline fallbacks, network retry)
- Reliable notifications? ✅ (push notification system)

**Modern Angular Architecture**:
- Angular 20+ standalone components? ✅ (Angular 20.1.8)
- Signal-based state management? ✅ (reactive patterns)
- OnPush change detection? ✅ (performance optimization)
- RxJS with takeUntilDestroyed? ✅ (proper cleanup)

**Testing & Code Quality**:
- Jest unit tests? ✅ (Jest 29.5.0 with Spectator)
- ESLint/Prettier enforcement? ✅ (code quality gates)
- TypeScript strict mode? ✅ (strict typing)
- Integration tests for critical flows? ✅ (notification, data sync)

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 3 (Mobile + API) - Angular/Ionic mobile app with Firebase backend integration

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/bash/update-agent-context.sh claude` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (data-model.md, contracts/, quickstart.md)
- TypeScript interfaces → type definition tasks [P]
- Service contracts → contract test tasks [P]
- User stories from quickstart → integration test tasks
- Angular components → component test tasks
- Firebase integration → service implementation tasks
- Push notifications → Capacitor plugin integration tasks

**Ordering Strategy**:
- TDD order: Contract tests → Integration tests → Unit tests → Implementation
- Dependency order:
  1. Type definitions and interfaces [P]
  2. Firebase service setup and contract tests [P]
  3. Core service implementations (FeedService, UserService)
  4. Notification service with Capacitor integration
  5. Angular components with Ionic UI
  6. Integration tests for complete user flows
- Mark [P] for parallel execution (independent tasks)

**Mobile-Specific Considerations**:
- Capacitor plugin configuration tasks
- Platform-specific notification setup (iOS/Android)
- Ionic component testing with spectator
- Angular service testing with Firebase emulators
- Performance testing for mobile constraints

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*