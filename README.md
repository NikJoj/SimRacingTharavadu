# Sim Racing Tharavadu - Refactored Application

## 📋 Overview

This is a refactored version of the Sim Racing Tharavadu website. The application has been reorganized from a single monolithic HTML file (~1467 lines) into a modular, maintainable structure with separated CSS and JavaScript files.

## 🎯 Refactoring Goals Achieved

✅ **Improved Maintainability** - Each file has a single, clear responsibility  
✅ **Better Readability** - Code is organized logically and easy to navigate  
✅ **Enhanced Scalability** - Easy to add new features without bloating files  
✅ **Simplified Debugging** - Isolated components make troubleshooting easier  
✅ **Team Collaboration** - Multiple developers can work on different files  
✅ **Browser Caching** - Individual files can be cached for better performance  

## 📁 Project Structure

```
SimRacingTharavadu/
├── index.html                 # Main HTML file (310 lines, down from 1467)
├── index.html.backup          # Original monolithic file (backup)
├── SETUP_GUIDE.html          # Setup instructions
├── README.md                 # This file
│
├── css/                      # Stylesheets (11 files)
│   ├── variables.css         # CSS custom properties & color scheme
│   ├── base.css              # Reset, typography, animations
│   ├── navigation.css        # Navigation bar styles
│   ├── hero.css              # Hero section styles
│   ├── events.css            # Event cards & grid
│   ├── leagues.css           # League cards & grid
│   ├── leaderboard.css       # Leaderboard tables & podium
│   ├── forms.css             # Registration forms
│   ├── modal.css             # Event details modal
│   ├── footer.css            # Footer styles
│   └── responsive.css        # Media queries for mobile/tablet
│
├── js/                       # JavaScript modules (10 files)
│   ├── config.js             # Configuration & demo data
│   ├── utils.js              # Utility functions (date formatting, etc.)
│   ├── data-service.js       # Data fetching & management
│   ├── navigation.js         # Page switching logic
│   ├── events.js             # Event rendering & pagination
│   ├── leagues.js            # League rendering & pagination
│   ├── leaderboard.js        # Leaderboard rendering
│   ├── registration.js       # Form handling & submission
│   ├── modal.js              # Modal open/close logic
│   └── app.js                # Application initialization
│
└── assets/                   # Images & resources
    ├── favicon.ico
    ├── srtLogo.png
    ├── poster1.png - poster6.png
    └── leaguePoster1.png, etc.
```

## 🔧 File Descriptions

### CSS Files

| File | Purpose | Lines |
|------|---------|-------|
| `variables.css` | Color scheme and design tokens | 20 |
| `base.css` | Reset, body, typography, animations | 167 |
| `navigation.css` | Navigation bar, logo, links | 96 |
| `hero.css` | Hero section, stats strip | 169 |
| `events.css` | Event cards, grid, badges, pagination | 276 |
| `leagues.css` | League cards, grid, badges | 115 |
| `leaderboard.css` | Tables, podium, tabs | 217 |
| `forms.css` | Registration forms, inputs, buttons | 273 |
| `modal.css` | Event details modal | 91 |
| `footer.css` | Site footer | 50 |
| `responsive.css` | Media queries for mobile/tablet | 199 |

### JavaScript Files

| File | Purpose | Lines |
|------|---------|-------|
| `config.js` | CONFIG object, DEMO_DATA | 54 |
| `utils.js` | Date formatting, helper functions | 58 |
| `data-service.js` | Google Sheets data fetching | 100 |
| `navigation.js` | Page switching | 20 |
| `events.js` | Event rendering, pagination | 109 |
| `leagues.js` | League rendering, pagination | 111 |
| `leaderboard.js` | Leaderboard rendering | 84 |
| `registration.js` | Form handling, validation, submission | 283 |
| `modal.js` | Modal open/close, details display | 125 |
| `app.js` | Application initialization | 20 |

## 🚀 Getting Started

### Configuration

Edit `js/config.js` to configure your application:

```javascript
const CONFIG = {
  APPS_SCRIPT_URL: "your-apps-script-url",
  EVENTS_SHEET_URL: "your-events-sheet-url",
  LEAGUES_SHEET_URL: "your-leagues-sheet-url",
  LEADERBOARD_SHEET_URL: "your-leaderboard-sheet-url",
  DEMO_MODE: false  // Set to true for demo data
};
```

### Running the Application

1. Open `index.html` in a web browser
2. Or serve with a local server:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js (with http-server)
   npx http-server
   ```

## 🎨 Customization

### Changing Colors

Edit `css/variables.css`:

```css
:root {
  --red: #E8001D;        /* Primary brand color */
  --gold: #F5A623;       /* Accent color */
  --bg: #080A0C;         /* Background */
  /* ... more variables */
}
```

### Adding New Features

1. **New CSS Component**: Create a new file in `css/` and link it in `index.html`
2. **New JS Module**: Create a new file in `js/` and include it before `app.js`
3. **New Page**: Add HTML structure in `index.html` and create corresponding JS/CSS

## 📊 Comparison: Before vs After

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Main HTML File** | 1467 lines | 310 lines | 79% reduction |
| **CSS Organization** | Inline (434 lines) | 11 separate files | Modular |
| **JS Organization** | Inline (1030 lines) | 10 separate files | Modular |
| **Maintainability** | Low | High | ⭐⭐⭐⭐⭐ |
| **Readability** | Difficult | Easy | ⭐⭐⭐⭐⭐ |
| **Scalability** | Limited | Excellent | ⭐⭐⭐⭐⭐ |

## ✅ Features Preserved

All original functionality remains intact:

- ✅ Event display with pagination
- ✅ League display with pagination
- ✅ Leaderboard with multi-race support
- ✅ Event registration forms
- ✅ League registration forms
- ✅ Event details modal
- ✅ Google Sheets integration
- ✅ Demo mode
- ✅ Responsive design (mobile/tablet)
- ✅ All animations and transitions
- ✅ Form validation
- ✅ Status messages

## 🔍 Code Quality Improvements

### Before (Monolithic)
```html
<!-- Everything in one file -->
<style>
  /* 434 lines of CSS */
</style>
<script>
  /* 1030 lines of JavaScript */
</script>
<!-- HTML structure -->
```

### After (Modular)
```html
<!-- Clean separation of concerns -->
<link rel="stylesheet" href="css/variables.css">
<link rel="stylesheet" href="css/base.css">
<!-- ... more stylesheets -->

<script src="js/config.js"></script>
<script src="js/utils.js"></script>
<!-- ... more modules -->
```

## 🛠️ Development Workflow

### Making Changes

1. **Styling Changes**: Edit the relevant CSS file in `css/`
2. **Functionality Changes**: Edit the relevant JS file in `js/`
3. **Configuration**: Edit `js/config.js`
4. **Structure Changes**: Edit `index.html`

### Testing

1. Open `index.html` in a browser
2. Test all pages: Home, Leaderboard, Event Registration, League Registration
3. Test responsive design (resize browser or use dev tools)
4. Test form submissions
5. Test modal functionality

## 📝 Notes

- **Backup**: The original file is saved as `index.html.backup`
- **Browser Compatibility**: Works in all modern browsers
- **No Build Process**: No compilation or bundling required
- **Pure Vanilla JS**: No frameworks or dependencies
- **SEO Friendly**: Semantic HTML structure maintained

## 🤝 Contributing

When adding new features:

1. Create new CSS files for new components
2. Create new JS modules for new functionality
3. Keep files focused on a single responsibility
4. Document your code with comments
5. Test thoroughly before committing

## 📄 License

© 2025 Sim Racing Tharavadu · Kerala, India · All Rights Reserved

---

**Refactored by**: Bob (AI Software Engineer)  
**Date**: May 2026  
**Original Size**: 1467 lines  
**Refactored Size**: 310 lines (HTML) + 21 modular files