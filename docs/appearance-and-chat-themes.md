# Nexa Appearance and Chat Themes Architecture

## 1. Overview
Nexa provides a centralized, typed design token system for global appearance modes and per-conversation chat customization.

## 2. Global Appearance Modes
- **Light (`nexa-day`)**: Clean ice/pearl surfaces with indigo-violet accents.
- **Dark (`nexa-night`)**: Deep navy/slate surfaces with violet-cyan accents.
- **System**: Automatically matches `prefers-color-scheme`.
- **High Contrast**: Solid high-contrast surfaces meeting WCAG 2.2 AAA guidelines.

## 3. Scheduled Day/Night Shifting
- Automatically shifts to Dark Mode between 8:00 PM (20:00) and 6:00 AM (06:00) local time.
- Configurable via `ThemeContext` and persisted in `localStorage` and Oracle `USER_APPEARANCE_PREFERENCES` table.

## 4. Per-Chat Custom Themes
- **Cyberpunk Neon**: Dark slate background with gradient purple-indigo bubbles.
- **Emerald Aurora**: Deep slate background with emerald-teal accents.
- **Sunset Blaze**: Midnight background with rose-orange accents.
