# Clean Code & Design Patterns Skill

A comprehensive skill for applying SOLID principles, design patterns, and clean code practices in the Dreamer project.

## What's Inside

- **SKILL.md** (637 lines) - Main skill file with practical TypeScript examples
  - SOLID principles with Dreamer-specific applications
  - Core principles (DRY, KISS, YAGNI, Composition over Inheritance)
  - Design patterns (Repository, Strategy, Factory, Observer, Adapter, Facade)
  - Fastify, Prisma, and Vue 3 specific patterns
  - Code review checklist

- **reference.md** (489 lines) - Anti-patterns and refactoring guide
  - 8 common code smells with before/after examples
  - Quick reference: Code Smell → Solution mapping
  - Refactoring workflow

- **examples.md** (730 lines) - Real-world Dreamer project examples
  - TTS provider refactoring (Strategy pattern)
  - Episode generation (Facade + Template Method)
  - Job type labels (DRY principle)
  - Prisma repository pattern (DIP)
  - Vue composables (Separation of Concerns)

## When It's Used

The agent will automatically apply this skill when:

- Writing new features or services
- Refactoring existing code
- Reviewing pull requests
- Designing system architecture
- Discussing technical decisions
- You mention: SOLID, design patterns, clean code, refactoring, code review

## Key Topics Covered

### SOLID Principles

- ✅ Single Responsibility Principle (SRP)
- ✅ Open/Closed Principle (OCP)
- ✅ Liskov Substitution Principle (LSP)
- ✅ Interface Segregation Principle (ISP)
- ✅ Dependency Inversion Principle (DIP)

### Design Patterns

- ✅ Repository Pattern (Data Access)
- ✅ Strategy Pattern (Algorithm Selection)
- ✅ Factory Pattern (Object Creation)
- ✅ Observer Pattern (Event Handling)
- ✅ Adapter Pattern (Interface Conversion)
- ✅ Facade Pattern (Simplified Interface)
- ✅ Template Method Pattern

### Tech Stack Specific

- ✅ Fastify route/handler/service patterns
- ✅ Prisma best practices (select, avoid N+1, transactions)
- ✅ Vue 3 Composition API and composables
- ✅ TypeScript type safety

## Integration with Project Standards

This skill complements the existing project documentation:

- [docs/CODING_STANDARDS.md](../../docs/CODING_STANDARDS.md) - Project coding standards
- [docs/CODE_REVIEW_CHECKLIST.md](../../docs/CODE_REVIEW_CHECKLIST.md) - Code review checklist
- [AGENTS.md](../../AGENTS.md) - Development workflow and rules

## Usage Examples

Just ask the agent to:

- "Review this code for SOLID violations"
- "Refactor this service using the Strategy pattern"
- "Apply clean code principles to this function"
- "What design pattern should I use for X?"
- "Check if this follows the repository pattern"

## License

Part of the Dreamer project.
