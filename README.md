# SoftInterio - Interior Design ERP System

A modern, modular ERP system built specifically for interior design companies. Built with Next.js 16, TypeScript, and Tailwind CSS with a focus on scalability and maintainability.

## 🎯 Project Overview

SoftInterio is designed to streamline interior design business operations with a comprehensive suite of tools for project management, client relationships, inventory tracking, and financial operations.

### Key Features

- **Authentication System**: Complete sign-in, sign-up, and password recovery
- **Dashboard**: Comprehensive overview with key metrics and quick actions
- **Modular Architecture**: Loosely coupled modules for easy maintenance and expansion
- **Responsive Design**: Mobile-first approach with modern UI/UX
- **TypeScript**: Full type safety throughout the application
- **Scalable Structure**: Ready for Vercel deployment and Supabase integration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- VS Code (recommended)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The application will be available at `http://localhost:3000`

## 🏗️ Architecture

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Reusable UI components
│   ├── layout/           # Layout components (Header, Sidebar)
│   └── ui/               # Base UI components (Button, Input)
├── modules/              # Feature modules
│   ├── auth/            # Authentication module
│   │   └── components/  # Auth-specific components
│   └── dashboard/       # Dashboard module
│       └── components/  # Dashboard-specific components
├── types/               # TypeScript type definitions
├── lib/                 # Utility libraries
├── utils/               # Helper functions
└── hooks/               # Custom React hooks
```

### Modular Design Principles

- **Separation of Concerns**: Each module handles a specific business domain
- **Component Isolation**: UI components are reusable and independent
- **Type Safety**: Comprehensive TypeScript coverage
- **Scalable Routing**: App Router for file-system based routing

## 🧩 Available Modules

### Authentication Module (`src/modules/auth/`)

- Sign In with email/password
- Sign Up with profile creation
- Forgot Password workflow
- Responsive authentication layout

### Dashboard Module (`src/modules/dashboard/`)

- Overview with key metrics
- Project status tracking
- Quick action shortcuts
- Responsive dashboard layout

### Planned Modules (Ready for Implementation)

- **Projects**: Project management and tracking
- **Clients**: Customer relationship management
- **Inventory**: Material and resource tracking
- **Quotations**: Pricing and proposal management
- **Calendar**: Appointment and deadline scheduling
- **Reports**: Analytics and business intelligence

## 💻 Development

### Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Create production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler

### Adding New Modules

1. Create module directory in `src/modules/[module-name]/`
2. Add components in `src/modules/[module-name]/components/`
3. Create corresponding app routes in `src/app/[route-name]/`
4. Update navigation in `src/components/layout/Sidebar.tsx`

### VS Code Tasks

The project includes a VS Code task for starting the development server:

- **Start Development Server**: Launches `npm run dev` with Turbopack

## 🛠️ Technology Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: Custom UI components with class-variance-authority
- **Development**: ESLint, VS Code integration
- **Build Tool**: Turbopack (Next.js built-in)

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel
```

### Manual Deployment

```bash
# Build the project
npm run build

# The built files will be in .next/ directory
```

### Environment Variables

When deploying, ensure to set up environment variables for:

- Database connections (Supabase)
- Authentication providers
- API endpoints

## 🔒 Security Considerations

- All forms include CSRF protection
- Environment variables for sensitive data
- TypeScript for compile-time safety
- ESLint for code quality

## 📱 UI/UX Features

- **Responsive Design**: Mobile-first approach
- **Modern UI**: Clean, professional interface
- **Consistent Styling**: Unified design system
- **Accessibility**: WCAG compliant components
- **Performance**: Optimized for speed

## 🤝 Contributing

1. Create feature branch from main
2. Implement changes following existing patterns
3. Ensure TypeScript compilation passes
4. Test responsiveness across devices
5. Submit pull request

## 📄 License

This project is licensed under the ISC License.

## 📞 Support

For support and questions:

- Check the documentation in each module
- Review component examples in `/src/components/`
- Refer to Next.js documentation for framework-specific questions

---

**Note**: This is a UI-focused implementation. Backend integration with Supabase and additional business logic can be added as needed.
