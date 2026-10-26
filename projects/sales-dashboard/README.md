# Sales KPI Dashboard

Standalone Ignite UI for React sample. KPI cards, revenue and deals charts, revenue by region, recent activity and a leaderboard, in a light and a dark appearance.

It uses these Ignite UI for React components:

- `igniteui-react`: cards, avatars, badges, icons, icon button and list.
- `igniteui-react-grids`: the Recent Activity grid.
- `igniteui-react-charts`: the Revenue Trend and Deals Closed charts (category chart) and the Revenue by Region doughnut.

## Run locally

1. Install dependencies:
   npm install
2. Start development server:
   npm start

## Build

npm run build

## Structure

- `src/app.tsx`: the dashboard, with its appearance switch.
- `src/components`: the header, the KPI cards, the three charts, the activity grid and the leaderboard.
- `src/data/sales-data.ts`: the numbers the dashboard shows.
- `src/theme`: the chart colours for both appearances, the icons and the fonts.
- `src/styles`: the palettes (`_palette.scss`), the grid, card and list themes (`_theme.scss`), the layout and the widgets.

## Notes

- The sample themes the Fluent light theme with its own palettes. The dark appearance re-declares the palette on the dashboard element, so everything that reads a palette colour follows.
- The charts paint to canvas and take their colours when they are built, so each appearance has its own set of charts. The old ones are destroyed explicitly: the chart components do not stop their size watchers when they unmount.
- The charts also lay their labels out once, so they are built after the fonts have loaded.
