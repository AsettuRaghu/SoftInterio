# Tailwind CSS v4 Migration Guidelines

This document outlines the common class name changes in Tailwind CSS v4 to prevent recurring issues.

## Updated Gradient Syntax

### ❌ Old (v3):

```css
bg-gradient-to-r
bg-gradient-to-l
bg-gradient-to-t
bg-gradient-to-b
bg-gradient-to-br
bg-gradient-to-bl
bg-gradient-to-tr
bg-gradient-to-tl
```

### ✅ New (v4):

```css
bg-linear-to-r
bg-linear-to-l
bg-linear-to-t
bg-linear-to-b
bg-linear-to-br
bg-linear-to-bl
bg-linear-to-tr
bg-linear-to-tl
```

## Updated Flex Utilities

### ❌ Old (v3):

```css
flex-shrink-0  →  shrink-0
flex-grow-0    →  grow-0
flex-shrink    →  shrink
flex-grow      →  grow
```

### ✅ New (v4):

```css
shrink-0
grow-0
shrink
grow
```

## Quick Find & Replace Commands

To fix these issues project-wide, run these commands from the project root:

### Fix Gradients:

```bash
find src -name "*.tsx" -type f -exec sed -i '' 's/bg-gradient-to-/bg-linear-to-/g' {} +
```

### Fix Flex Classes:

```bash
find src -name "*.tsx" -type f -exec sed -i '' 's/flex-shrink-0/shrink-0/g' {} +
find src -name "*.tsx" -type f -exec sed -i '' 's/flex-grow-0/grow-0/g' {} +
```

## VS Code Settings

Add this to your `.vscode/settings.json` to get better Tailwind warnings:

```json
{
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "tailwindCSS.validate": true,
  "css.validate": false
}
```

## All Fixed Issues in This Project:

✅ All gradient classes updated to `bg-linear-to-*`
✅ All flex utilities updated to modern syntax
✅ Build completes without class name warnings

Last updated: November 21, 2025
