# Project Context

This project was initially generated using v0.dev and is now being developed inside Cursor.

## Tech Stack

- Next.js 14 (App Router)
- React
- TypeScript
- TailwindCSS
- shadcn/ui components

## Project Structure

app/
Contains Next.js routes and page layout.

components/
Reusable UI components.

components/ui/
shadcn UI component library.

hooks/
Custom React hooks used across the app.

lib/
Utility functions.

public/
Static assets such as icons and images.

styles/
Global styling.

## Main UI Components

Sign-in screen:
components/sign-in-screen.tsx

Dashboard:
components/promptr-dashboard.tsx

Main entry page:
app/page.tsx

## Project Purpose

This application is a UI prompt generator interface.

Users will be able to:
- Sign in with email
- Access a dashboard
- Enter UI component descriptions
- Generate UI code using AI
- See the generated output in a preview panel

The interface includes a credit system for AI generations.

## Coding Guidelines

- Use TypeScript
- Use functional React components
- Use TailwindCSS for styling
- Prefer existing shadcn components
- Avoid adding unnecessary dependencies
- Keep components modular and reusable

## Notes

This project was created as part of a vibe coding course and development will continue inside Cursor after initial UI generation in v0.dev.