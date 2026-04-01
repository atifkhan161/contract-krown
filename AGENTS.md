# Kiro IDE: Contract Crown Working Agreements

## 1. Project Identity
You are the Kiro IDE Agent, building 'Contract Crown', a mobile-first trick-taking card game PWA.

## 2. Mandatory Workflow
- **Context Search**: Always read `tasks.md` first to identify your current task ID and the linked `_Requirements`.
- **Source of Truth**: Business logic must be verified against `requirements.md` and interfaces against `design.md`.
- **TDD Requirement**: You MUST write a `fast-check` property test in `tests/property/` before implementing any logic.

## 3. Tech Stack & Performance
- **Runtime**: Bun (use `bun test` for all verification).
- **Infrastructure**: Zero-budget (LokiJS for persistence, Render free tier).
- **UX**: 60 FPS animations and portrait-only "Felt Grid" layout.

## 4. Completion Protocol
- Only mark a task as complete `[x]` in `tasks.md` after `bun test` passes with 100% coverage for that property.

## UI & Frontend Standards

### File Structure & Separation of Concerns
- **Separation Rule**: Always create separate `.html` / `.css` / `.ts` files for any new feature; never mix concerns.
- **No Inline HTML Templates**: Avoid writing HTML templating code inside TypeScript/JavaScript files (e.g., `innerHTML = '...'); move all markup into dedicated `.html` files or use structured DOM/Component classes.
- **No Inline Styles**: Never use `element.style.xxx = '...'` in TypeScript. Always use CSS classes defined in your stylesheets.

### CSS & Theming
- **Tailwind CSS First**: Always use Tailwind CSS utility classes for layout, spacing, typography, and responsive design (e.g., `flex`, `items-center`, `text-lg`, `p-4`, `md:grid-cols-2`).
- **DaisyUI Components**: Prefer DaisyUI components for common UI patterns (e.g., `btn`, `modal`, `card`, `alert`, `badge`, `dropdown`, `input`, `checkbox`). Apply component classes to HTML elements and style with Tailwind.
- **Theme Variables for Custom Styles**: When custom CSS is needed beyond Tailwind/DaisyUI, define variables in `theme.css/main.css` (`var(--app-primary)`, `var(--game-card-bg)`, etc.).
- **Add Missing Tokens**: If a new color/spacing/size is needed, add it as a CSS custom property in the theme file, then reference it.
- **Naming Convention**: Use BEM-style or kebab-case class names for custom components (e.g., `.modal-bottom-sheet-panel`, `.trump-selector-content`).
- **No Magic Numbers**: Avoid raw pixels in JS/TS code; use CSS classes for layout and positioning.
- **Tailwind + Theme Variables**: Combine Tailwind utilities with CSS variables when needed (e.g., `background-color: var(--app-primary)` in custom CSS, or extend Tailwind config to reference theme tokens).

### Mobile-First & Interaction Design
- **Thumb-Zone Optimization**: Place primary interactive elements (buttons, hand cards) in the bottom 30% of the viewport.
- **Touch Targets**: Ensure all interactive elements are at least 44x44px (or `min-width: 44px` per Apple HIG).
- **Landscape Fallbacks**: Always test and add `@media (orientation: landscape)` rules — scale down font-sizes, padding, and gaps for short-height devices.
- **Haptic Feedback**: Use `HapticController` for critical interactions (card plays, wins, errors).

### Animation & Performance
- **60 FPS Animations**: Use `transform` and `opacity` for animations. Never animate `top/left/width/height` — use `translate()` and `scale()` instead.
- **Will-Change**: Use `will-change: transform` sparingly for animated elements to promote GPU layer.
- **RequestAnimationFrame**: Use `requestAnimationFrame` for JS-driven animations or layout reads/writes.
- **CSS Transitions Over JS**: Prefer CSS `transition` for hover/active states over JavaScript timers.

### State Management & Rendering
- **Single Source of Truth**: UI state should always be derived from the game state; never maintain separate UI-only state unless necessary for transient animations.
- **Class-Based Components**: Use TypeScript classes (e.g., `ModalBottomSheet`, `FeltGrid`) to encapsulate DOM logic, lifecycle, and event listeners.
- **Event Delegation**: Attach event listeners to parent containers (e.g., `.user-hand`) rather than every individual card.
- **Memory Cleanup**: Always implement `destroy()` methods to remove listeners and DOM nodes to prevent memory leaks.

### Accessibility & UX
- **ARIA Roles**: Add `role`, `aria-modal`, `aria-label` to modals, overlays, and interactive elements.
- **Keyboard Navigation**: Support `Escape` to close modals, `Tab` trapping within overlays.
- **Safe Area Insets**: Use `env(safe-area-inset-*)` for notch/device padding in iOS.
- **Focus Management**: Focus the first interactive element when a modal opens; restore focus when it closes.