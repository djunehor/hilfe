# Hilfe - Nigeria Community Security Radar

Hilfe is a crowd-sourced, real-time security incident and hazard mapping application designed for Nigeria. It empowers citizens to report, track, and stay alert to security threats, illegal checkpoints, and roadblocks with precise GPS coordinate updates.

## Features

- **Interactive Map**: Built with Leaflet.js and CartoDB Dark tiles for a high-contrast dark-mode interface.
- **Dynamic Hotspot Clustering**: Proximity-based clustering aggregates multiple nearby reports into larger pulsing warning circles.
- **Location-Based Search & Sorting**:
  - Auto-completing location search using OSM Nominatim.
  - Quick GPS search ("📍 Search near me") to center on your physical coordinates.
  - Sidebars and feeds automatically sort incidents by closest proximity first, displaying distances (e.g. `12.5 km away`).
- **Threat Severity Categorization**: Supports color-coded threat labels (`Low`, `Medium`, `High`, `Critical`) for rapid assessment.
- **Verification Image Attachment**: Allows users to upload and preview verification images that render on map popups and feed cards.
- **Serverless Backend**: Designed for Cloudflare Pages (frontend) and Pages Functions (backend workers API) with Cloudflare D1 Database integration.
- **Mobile Responsive Layout**: Premium glassmorphic design that adapts seamlessly to phones and tablets.

## Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript, Vanilla CSS
- **Mapping**: Leaflet.js
- **Backend API**: Cloudflare Pages Functions
- **Database**: Cloudflare D1 Database (SQLite)
- **Testing**: Vitest with JSDOM
- **Build Tool**: Vite

## Getting Started

### Installation

Install dependencies:
```bash
npm install
```

### Running Tests

Run the Vitest test suite:
```bash
npm test
```

### Development Server

Start Vite dev server:
```bash
npm run dev
```

### Production Build

Build for production deployment:
```bash
npm run build
```

### Deployment

Deploy to Cloudflare Pages:
```bash
npx wrangler pages deploy dist
```


<!-- Security scan triggered at 2026-08-31 16:50:46 -->