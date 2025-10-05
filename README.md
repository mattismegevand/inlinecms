# InlineCMS

## Simplest CMS for Astro blogs

A modern, TypeScript-first Astro integration that enables seamless inline editing of Markdown content during development. Edit blog posts, documentation, and any markdown-based content directly in your browser with real-time auto-save.

https://github.com/user-attachments/assets/01702a21-deac-4302-9ba5-3155d4236d2a

## ✨ Features

- **⚡ Real-time Editing** - Click any content and start typing
- **📝 Post Management** - Create, delete, and manage posts with clean UI
- **⚙️ Frontmatter Editor** - Edit YAML frontmatter with syntax validation
- **↶ Undo/Redo System** - Full history tracking with Ctrl+Z/Ctrl+Y
- **💾 Smart Auto-save** - Debounced saving with retry logic and error recovery
- **🖼️ Image Support** - Drag & drop images with file type validation
- **⌨️ Rich Keyboard Shortcuts** - Bold (Ctrl+B), Italic (Ctrl+I), Links (Ctrl+K)
- **📝 Markdown Aware** - Proper list indentation, heading levels, code blocks
- **🔄 Unsaved Changes Tracking** - Visual indicators and browser warnings
- **🧩 Minimal Codebase** - Tinygrad-style: ~660 lines for core, no abstractions
- **🎨 Professional UX** - Smooth animations, toast notifications, modal dialogs
- **📱 TypeScript First** - Full type safety and IntelliSense support

## 📦 Installation

```bash
npm install inlinecms
# or
bun add inlinecms
# or
pnpm add inlinecms
# or
yarn add inlinecms
```

## 🚀 Quick Start

### 1. Add the Integration

```ts
// astro.config.mjs
import inlineCMS from "inlinecms";

export default {
  integrations: [inlineCMS("src/content/blog")],
};
```

### 2. Wrap Your Markdown Content

```astro
<!-- src/layouts/BlogLayout.astro -->
<div data-markdown>
  <slot />
</div>
```

### 3. Start Developing

```bash
npm run dev
```

That's it! Your markdown content is now editable inline during development.

## ⚙️ Configuration

### Basic Usage

```ts
// Simple string for content directory
inlineCMS("src/content/blog");
```

### Advanced Configuration

```ts
// Full configuration object
inlineCMS({
  contentDir: "src/content/blog",
  urlPattern: "/posts/{slug}/", // URL pattern (default: "/posts/{slug}/")
  autosaveDelay: 1000, // Auto-save delay in ms (default: 2000)
  enabled: true, // Enable/disable (default: true)
});
```

### Environment-based Setup

```ts
// Only enable in development
inlineCMS({
  contentDir: "src/content/blog",
  enabled: import.meta.env.DEV,
});
```

## 🎮 Usage Guide

### Editing Content

- **Click** any text to start editing
- **Type naturally** - content auto-saves after 2 seconds of inactivity
- **Status indicator** shows current state (editing, saving, saved)

### Keyboard Shortcuts

**Post Management:**

- `Ctrl+N` - Create new post
- `Ctrl+Shift+L` - List all posts
- `Ctrl+Shift+F` - Edit frontmatter
- `Ctrl+Shift+D` - Delete current post

**Editing:**

- `Ctrl+S` - Manual save
- `Ctrl+Z` - Undo
- `Ctrl+Y` / `Ctrl+Shift+Z` - Redo
- `Ctrl+B` - Toggle bold
- `Ctrl+I` - Toggle italic
- `Ctrl+K` - Create/edit links
- `Tab` - Indent list items or add 4 spaces in code blocks
- `Shift+Tab` - Outdent list items or remove indentation in code blocks
- `Backspace` (at heading start) - Decrease heading level
- `Enter` (in empty list item) - Exit list

### Images

- **Drag & drop** images directly into content
- **File type validation** (JPG, PNG, GIF, WebP, SVG)
- **Size limits** (10MB max)
- Automatic upload to `public/uploads/` directory
- Proper markdown image syntax generation

### Post Management UI

- **Floating sidebar** for easy access
- **Toast notifications** for user feedback
- **Modal dialogs** for post creation and editing
- **Frontmatter editor** with YAML syntax validation

### Lists & Structure

- Smart list handling with Tab/Shift+Tab indentation
- Automatic list exit when pressing Enter in empty items
- Heading level management with Backspace
- Code block editing with proper Tab behavior

## 🛡️ Error Handling

InlineCMS includes robust error handling:

- **Automatic retry** with exponential backoff (1s, 2s, 4s delays)
- **Network failure recovery** with user-friendly dialogs
- **Unsaved changes warnings** before page navigation
- **Detailed error logging** for debugging

## 🔧 Development

### Setup

```bash
git clone <repository>
cd inlinecms
bun install
```

### Build

```bash
bun run build        # Build for production
bun run type-check   # TypeScript type checking
bun run format       # Format code with Prettier
```

### Project Structure (Tinygrad-style: Simple & Minimal)

```
inlinecms/
├── src/
│   ├── inlinecms.ts          # Main editor (671 lines - all core features)
│   ├── plugins.ts            # Image/Post/Modal (378 lines - merged)
│   └── main.ts               # Entry point (27 lines)
├── index.ts                  # Astro integration (348 lines)
└── dist/
    ├── index.js              # Server bundle
    └── client.js             # Client bundle

Total: ~1424 lines (down from ~4000)
```

**Philosophy**: Like tinygrad, we prioritize simplicity over abstraction.
- Core editor is **one file** (671 lines) - all DOM helpers, undo/redo, status, keyboard, lists, code, math inlined
- All plugins **merged** into one file (378 lines) - Image, Post Management, Modals, API
- Server integration **simplified** (348 lines) - no repetition, common helpers extracted
- **No folders** for core/utils/types - everything flat and minimal

## 📝 TypeScript Support

InlineCMS is built with TypeScript-first principles:

```ts
import type { InlineCMSConfig } from "inlinecms";

const config: InlineCMSConfig = {
  contentDir: "src/content/blog",
  autosaveDelay: 1500,
  enabled: import.meta.env.DEV,
};
```

Full IntelliSense support for configuration options and API.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details.
