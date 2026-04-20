# Hiker 🥾

A hiking trail explorer for Israel with an interactive map and filtering system.

## Overview

**Hiker** is a web-based application that aggregates hiking trails from multiple sources and presents them on an interactive map. Users can filter trails by difficulty, length, and tags to find their perfect hike.

### What's Inside

**🖼️ Frontend** - Vibe-coded vanilla JavaScript + HTML/CSS
- Interactive Leaflet map
- Hebrew-language interface  
- Real-time filtering by distance and tags
- Responsive design with collapsible sidebar
- Trail details popup

**🐍 Backend** - Hand-written Python scrapers
- Parallel scraping from multiple hiking data sources ([Parks.org.il](https://www.parks.org.il/), [Tiuli](https://www.tiuli.com/), [kkl](https://www.kkl.org.il/travel)
- Data aggregation and normalization
- Exports to JSON for use by the frontend

## Features

- 🗺️ **Interactive Map** - Browse trails on a Leaflet map with markers
- 🔍 **Smart Filtering** - Filter by trail length and tags (e.g., dog-friendly, water, scenic)
- 📊 **Sorting** - Sort trails by name, length, difficulty, or geography
- 📱 **Mobile Responsive** - Works on desktop and mobile devices
- 🌐 **No Backend Required** - Static site deployed via GitHub Pages (data served as JSON)

## Getting Started

### Running the Data Scraper

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

This generates `hikes.json` with the latest trail data.

### Running Locally

The frontend is a static site. Serve it locally:

```bash
# Using Python
cd docs
python -m http.server 8000

# Or use any other static server
# Visit http://localhost:8000
```

## Data Sources

- **Parks** - Israeli national parks and nature reserves
- **Tuuli** - Community hiking database
- **KKL** - Jewish National Fund trails

## Transparency Notes

**Frontend Code** is intentionally informal and flexible ("vibe-coded"):
- Prioritizes functionality and rapid iteration
- Not heavily structured or commented

**Backend Code** is hand-written without external frameworks:
- Custom scrapers tailored to each source's HTML structure  
- No database layer, so the site can be hosted static
- Direct BeautifulSoup parsing

Both approaches work well for this project's scale and serve as reference implementations.

## Development

To add a new data source:
1. Create a new scraper file in `backend/` (e.g., `new_source.py`)
2. Implement `get_all_hikes()` function returning `list[HikeInfo]`
3. Import and add to parallel threads in `main.py`
4. Run `main.py` to generate updated `hikes.json`

## Deployment

The frontend is hosted on GitHub Pages via the `docs/` folder. Push to trigger automatic deployment.

---

**Happy Hiking ⛰️🏕️🥾**
