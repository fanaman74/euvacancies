# Design — EU Employment

The vacancy register and LinkedIn search use a cool grey soft UI: `#e0e5ec` surfaces, dark blue-grey type, violet actions, teal status, and opposing translucent shadows. Raised cards and controls use light from the upper left; inputs, the map and selected filters use inset shadows. Large panels use 32px corners and controls use 16px corners. Plus Jakarta Sans is the display face and DM Sans is used for body and controls.

Keep search, filters, pagination, country map, direct source links and the separate LinkedIn search functional. Text and focus indicators must remain legible, controls keyboard-accessible, and layout responsive. Motion respects reduced-motion preferences. The main theme lives in `public/soft-ui.css`; the LinkedIn page adapts it in `public/linkedin/css/soft-ui.css`.
