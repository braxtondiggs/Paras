# Constitution Update Checklist

When amending the constitution (`/memory/constitution.md`), ensure all dependent documents are updated to maintain consistency.

## Templates to Update

### When adding/modifying ANY principle:
- [ ] `/templates/plan-template.md` - Update Constitution Check section
- [ ] `/templates/spec-template.md` - Update if requirements/scope affected
- [ ] `/templates/tasks-template.md` - Update if new task types needed
- [ ] `/.claude/commands/plan.md` - Update if planning process changes
- [ ] `/.claude/commands/tasks.md` - Update if task generation affected
- [ ] `/CLAUDE.md` - Update runtime development guidelines

### Principle-specific updates:

#### Principle I (User-Centric Design):
- [ ] Ensure templates emphasize NYC resident needs
- [ ] Update user story examples
- [ ] Add accessibility requirement checks

#### Principle II (Mobile-First Performance):
- [ ] Update performance benchmarks in templates
- [ ] Add bundle size monitoring requirements
- [ ] Include offline functionality checks

#### Principle III (Data Accuracy):
- [ ] Update data validation requirements
- [ ] Emphasize error handling patterns
- [ ] Add notification reliability checks

#### Principle IV (Modern Angular Architecture):
- [ ] Update framework version requirements
- [ ] Add signal-based patterns to examples
- [ ] Include standalone component guidelines

#### Principle V (Testing & Code Quality):
- [ ] Update Jest testing requirements
- [ ] Add ESLint/Prettier enforcement
- [ ] Include TypeScript strict mode checks

## Validation Steps

1. **Before committing constitution changes:**
   - [ ] All templates reference new requirements
   - [ ] Examples updated to match new rules
   - [ ] No contradictions between documents

2. **After updating templates:**
   - [ ] Run through a sample implementation plan
   - [ ] Verify all constitution requirements addressed
   - [ ] Check that templates are self-contained (readable without constitution)

3. **Version tracking:**
   - [ ] Update constitution version number
   - [ ] Note version in template footers
   - [ ] Add amendment to constitution history

## Common Misses

Watch for these often-forgotten updates:
- Command documentation (`/commands/*.md`)
- Checklist items in templates
- Example code/commands
- Domain-specific variations (web vs mobile vs CLI)
- Cross-references between documents

## Template Sync Status

Last sync check: 2025-07-16
- Constitution version: 2.1.1
- Templates aligned: ❌ (missing versioning, observability details)

---

*This checklist ensures the constitution's principles are consistently applied across all project documentation.*