# SoftInterio - Interior Design ERP System

## Project Overview

This is a modern, modular ERP system built specifically for interior design companies using Next.js 16, TypeScript, and Tailwind CSS.

## Architecture Guidelines

### Modular Design

- Each business domain is organized as a separate module in `src/modules/`
- Modules contain their own components, types, and business logic
- Shared UI components live in `src/components/ui/`
- Layout components are in `src/components/layout/`

### File Organization

```
src/
├── app/                 # Next.js App Router pages
├── modules/            # Business logic modules
│   ├── auth/          # Authentication module
│   └── dashboard/     # Dashboard module
├── components/        # Shared components
│   ├── ui/           # Base UI components
│   └── layout/       # Layout components
├── types/            # TypeScript definitions
├── utils/            # Utility functions
└── hooks/            # Custom React hooks
```

### Development Standards

- Use TypeScript for all new code
- Follow the existing component patterns
- Implement responsive design with Tailwind CSS
- Use the established naming conventions
- Create reusable components when possible

### Component Guidelines

- Use `'use client'` for interactive components
- Implement proper TypeScript interfaces
- Follow the established styling patterns
- Use the utility functions from `@/utils/cn`

## Available Modules

- **Auth Module**: Complete authentication system
- **Dashboard Module**: Main dashboard with overview
- **Future Modules**: Projects, Clients, Inventory, Reports

## Development Workflow

1. Start development server: `npm run dev`
2. Build project: `npm run build`
3. Type checking: `npx tsc --noEmit`
4. The project is ready for Vercel deployment and Supabase integration
