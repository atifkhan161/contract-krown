# CSS Architecture - Contract Crown

## Overview

The CSS codebase is organized into **9 modular files** using standard PostCSS `@import` for clean, maintainable architecture with automatic dependency resolution.

## File Structure

```
src/ui/styles/
├── main.css                      # Clean import manifest (16 lines)
├── 01-theme-tokens.css           # Theme system & design tokens (~350 lines)
├── 02-base-layout.css            # HTML/body/root layout & resets (~30 lines)
├── 03-felt-grid.css              # 3x3 grid layout & game board (~200 lines)
├── 04-cards-animations.css       # Card styles, animations, transitions (~180 lines)
├── 05-components-modals.css      # Modals, menus, sheets (reusable) (~500 lines)
├── 06-components-forms.css       # Login, lobby, forms, buttons (~450 lines)
├── 07-views-game.css             # Game view, trick area, players (~230 lines)
├── 08-views-online.css           # Online multiplayer, waiting room, reconnection (~450 lines)
└── 09-responsive.css             # All media queries (iPhone 14 Pro Max focused) (~900 lines)
```

## Build Process

**How it works:**
1. `main.css` contains `@import` statements for all modular files
2. PostCSS CLI processes `main.css` with `postcss-import` plugin
3. `postcss-import` resolves and inlines all imports
4. Tailwind processes the combined CSS
5. Output: `dist/client/styles.css` (optimized, production-ready)

**Development:**
```bash
# Start dev server with CSS watcher (auto-rebuilds on changes)
bun run dev

# Edit any modular CSS file → changes auto-apply!
# No manual rebuild step needed
```

**Production:**
```bash
# Full build (server + client + CSS)
bun run build

# CSS-only build
bun run build:css
```

## Responsive Breakpoints

### iPhone 14 Pro Max (Primary Target)

**Portrait: 430×932**
```css
@media (min-width: 428px) and (max-width: 432px) and (orientation: portrait)
```

**Landscape: 932×430**
```css
@media (min-width: 930px) and (max-height: 432px) and (orientation: landscape)
```

### General Breakpoints

| Breakpoint | Target | Query |
|------------|--------|-------|
| Small phones | ≤375px | `@media (max-width: 375px)` |
| Portrait phones | 376-440px | `@media (min-width: 376px) and (max-width: 440px) and (orientation: portrait)` |
| Landscape short | ≤500px height | `@media (orientation: landscape) and (max-height: 500px)` |
| Tall phones | >750px height | `@media (min-height: 750px) and (orientation: portrait)` |

## Theme System

5 themes available:
1. **Golden Ascent** (default) - Black & Gold
2. **Royal Emerald** - Dark Green
3. **Crimson Velvet** - Dark Red
4. **Midnight Sapphire** - Dark Blue
5. **Royal Amethyst** - Dark Purple

Each theme defines:
- App-theme tokens (UI colors: backgrounds, surfaces, text)
- Felt grid colors (background gradients)
- Game-theme tokens (always green felt, card colors)

## Key Design Decisions

### 1. PostCSS @import Pattern
Standard CSS module pattern with automatic dependency resolution. No manual concatenation needed.

### 2. Import Order Matters
`@import` statements MUST come before `@tailwind` directives in `main.css`:
```css
/* ✅ Correct order */
@import './01-theme-tokens.css';
@import './02-base-layout.css';
/* ... other imports */

@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 3. Numbered File Prefixes
Ensures consistent import order: themes → base → components → views → responsive.

### 4. iPhone 14 Pro Max First
Dedicated breakpoints with pixel-perfect sizing for both portrait and landscape.

### 5. CSS Variable Theming
All colors use CSS custom properties (`var(--app-primary)`) for easy theme switching.

### 6. Mobile-First
- Portrait-only layout by default
- Thumb-zone optimization (actions in bottom 30%)
- Touch targets ≥44×44px
- Safe area insets for notch devices

## Adding New Styles

1. **Identify the category:**
   - Theme/token → `01-theme-tokens.css`
   - Layout/reset → `02-base-layout.css`
   - Grid/board → `03-felt-grid.css`
   - Cards/animations → `04-cards-animations.css`
   - Modal/menu → `05-components-modals.css`
   - Form/button → `06-components-forms.css`
   - Game view → `07-views-game.css`
   - Online/multiplayer → `08-views-online.css`
   - Responsive/media query → `09-responsive.css`

2. **Edit the modular file**

3. **Save the file** → PostCSS auto-rebuilds in dev mode!

**That's it!** No manual build step needed during development.

## Build Configuration

**PostCSS Config** (`postcss.config.js`):
```javascript
export default {
  plugins: {
    'postcss-import': {},    // Resolves @import statements FIRST
    tailwindcss: {},          // Processes Tailwind directives
    autoprefixer: {},         // Adds vendor prefixes
  },
};
```

**Package Scripts** (`package.json`):
```json
{
  "dev:css": "postcss src/ui/styles/main.css -o dist/client/styles.css --watch",
  "build:css": "postcss src/ui/styles/main.css -o dist/client/styles.css --no-map"
}
```

## Troubleshooting

### Issue: "@import must precede all other statements" warning
**Solution:** Move all `@import` statements to the top of `main.css`, before `@tailwind` directives.

### Issue: Styles not appearing in output
**Solution:** 
1. Check that the modular file is imported in `main.css`
2. Verify PostCSS config has `postcss-import` plugin
3. Run `bun run build:css` and check for errors

### Issue: Dev mode not auto-rebuilding
**Solution:** 
1. Ensure `bun run dev` is running (includes CSS watcher)
2. Check terminal for PostCSS errors
3. Verify file is saved

## Output Stats

- **Source files:** 9 modular CSS files (~3,300 lines total)
- **main.css:** 16 lines (clean import manifest)
- **Output:** `dist/client/styles.css` (~146KB unminified, ~112KB minified)
- **Build time:** ~300ms (PostCSS + Tailwind)
