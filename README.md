# 👑 CrownReader - Digital Crown Book Reader

CrownReader is a pure, browser-based web application that reimagines reading digital books paragraph-by-paragraph with the fluid precision and aesthetic of a smartwatch's **Digital Crown** carousel.

---

## 🚀 How to Run

No servers, build steps, or installations required. Simply open `index.html` in any modern web browser:

- **Double-click** `index.html` in your file explorer, or
- Right-click `index.html` and choose **Open with** -> **Google Chrome**, **Mozilla Firefox**, or **Microsoft Edge**.

---

## ✨ Features

- **3-Panel Vertical Digital Crown Carousel**:
  - **Top Panel**: Previous paragraph preview (scale 0.85, opacity 0.4)
  - **Middle Panel**: Active reading paragraph preview with vibrant accent glow (scale 1.0, opacity 1.0)
  - **Bottom Panel**: Next paragraph preview (scale 0.85, opacity 0.4)
- **Fluid 0.5s CSS Transitions**: Smooth `transform: translateY() scale()` and `opacity` transition dynamics with 500ms debounce locking to prevent rapid scrolling.
- **Physical Crown Dial Hardware Widget**: Interactive watch crown on the side that rotates with tactile ticks when navigating.
- **Full Paragraph Display**: Complete, beautifully formatted paragraph display with an optional drop-cap decorative first letter and internal scrolling for lengthy paragraphs.
- **Library View**:
  - Drag-and-drop or file browse upload zone.
  - Automatic parsing for `.txt`, `.epub`, and `.pdf` files.
  - Pre-loaded classic sample books (*The Time Machine*, *The Art of War*) ready to test immediately with 1 click.
  - Book grid cards with paragraph counts, reading percentage progress, and deletion controls.
- **Reader Settings Modal**:
  - **Themes**: 🌙 Dark (default), ☀️ Light, 📜 Sepia
  - **Typography**: Serif (Merriweather), Sans-serif (Inter), Monospace (JetBrains Mono)
  - **Font Size**: Adjustable slider (12px to 32px)
  - **Line Height**: Adjustable slider (1.2 to 3.0)
  - **Drop Cap Effect**: Toggle on / off
  - **Crown Haptic Click**: Web Audio API synthesized tactile tick sound toggle
- **Data Persistence**: Automatic saving to `localStorage` for books, progress, and user reading preferences.

---

## ⌨️ Controls & Navigation

| Input | Action |
| :--- | :--- |
| **Mouse Wheel** (over carousel) | Turn crown / navigate paragraphs |
| **Arrow Down / Arrow Right / Spacebar** | Next paragraph |
| **Arrow Up / Arrow Left** | Previous paragraph |
| **Touch Swipe Up / Down** (mobile) | Next / Previous paragraph |
| **Esc** | Return to Library View |
| **S** | Open / Close Settings |
| **Click Top / Bottom Panel** | Navigate to Previous / Next paragraph |
| **Click Crown Chevrons (▲ / ▼)** | Step to Previous / Next paragraph |

---

## 📁 File Structure

```text
crown-reader/
├── index.html       # Semantic single-page web app structure
├── styles.css       # Complete responsive styling and CSS variable themes
├── app.js           # Digital crown carousel animation engine, parsers, and state
└── README.md        # Documentation and guide
```

