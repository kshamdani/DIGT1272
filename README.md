# AccessWeb: The Accessible Internet Project

> **Live Site:** [https://accessweb.onrender.com/](https://accessweb.onrender.com/)

An interactive website built for the **DIGT 1272: Mobilizing Digital Citizenship** course (Week 4: The Accessible Internet). AccessWeb demonstrates WCAG 2.1 principles through hands on demos, letting users experience screen readers, keyboard navigation, real eye tracking, and contrast tools firsthand.

---

## Table of Contents

- [About the Project](#about-the-project)
- [Live Demo](#live-demo)
- [Pages](#pages)
- [Features](#features)
- [Accessibility Tools](#accessibility-tools)
- [Eye Tracking](#eye-tracking)
- [Standards Covered](#standards-covered)
- [Project Structure](#project-structure)
- [Running Locally](#running-locally)
- [Technology Stack](#technology-stack)
- [Guiding Questions](#guiding-questions)

---

## About the Project

Accessibility is too often treated as an optional add-on rather than a necessary component of digital citizenship. As governments, schools, and essential services move online, inaccessible design limits opportunities for full participation in digital society.

AccessWeb was built to demonstrate that **inclusive design is foundational**, not optional, and to give developers, designers, and educators an interactive way to understand the real impact of their design choices on people with disabilities.

---

## Live Demo

**[https://accessweb.onrender.com/](https://accessweb.onrender.com/)**

---

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Home page with key statistics and navigation overview |
| `about.html` | WCAG POUR principles, project timeline, and guiding questions |
| `demos.html` | Four interactive accessibility demos (tabbed) |
| `standards.html` | WCAG 2.1, Accessible Canada Act, and AODA explained |
| `why.html` | Real world impact areas, data, and universal design argument |

---

## Features

### Accessibility Controls (persistent across all pages)

All four controls persist via `sessionStorage` as you navigate between pages:

| Control | What it does |
|---------|-------------|
|**Screen Reader** | Announces every hovered element (links, buttons, headings, images, inputs) using the Web Speech API for actual audio output |
|**High Contrast** | Switches to a WCAG compliant high contrast theme (yellow on black) |
| **A+ Text Size** | Bumps the root font size from 16px → 20px, scaling all `rem`-based text proportionally |
|**Eye Tracking** | Enables gaze based interaction (see [Eye Tracking](#eye-tracking) below) |

---

## Accessibility Tools

### Screen Reader Simulation

When Screen Reader mode is enabled, hovering over any element announces it the way NVDA, JAWS, or VoiceOver would, including:

- **Buttons:** name, pressed state, instructions
- **Links:** destination, whether it opens in a new tab
- **Headings:** level and text
- **Images:** alt text, or flags missing alt as an accessibility failure
- **Inputs:** type, label, required status, current value
- **Landmarks:** nav, main, article, aside

Audio is spoken aloud via the browser's Web Speech API where supported.

### Keyboard Navigation Demo

An interactive grid demonstrating full keyboard operability:

- `Tab` / `Shift+Tab` to move between elements
- `Enter` / `Space` to activate
- Visible focus indicators on every element
- Live status announcements as you navigate

### Eye Tracking Demo (see full section below)

### Contrast Demo

- Side by side comparison of WCAG failing vs. WCAG passing contrast ratios
- Live slider to explore text lightness with real time WCAG rating (Fail / AA / AAA)

---

## Eye Tracking

Eye tracking is powered by **[WebGazer.js](https://webgazer.cs.brown.edu/)**, which is an open source library from Brown University that uses your webcam and machine learning to estimate gaze position in real time.

### Modes

When you click **Eye Tracking**, you choose between:

- **Real Eye Tracking**, which uses your webcam + WebGazer.js with a 9-point calibration sequence
- **Mouse Simulation**, which uses cursor position simulates gaze, no camera required

### How to Click with Your Eyes (Dwell-Click)

Look at any link or button and **hold your gaze steady for 1.5 seconds**. You will see:

1. A circular progress ring fills around the element
2. The ring shifts from blue to green as it fills
3. Audio ticks at 25%, 50%, and 75% progress
4. A green flash and ascending chord when the element activates

### How to Scroll with Your Eyes

Scroll zones are active whenever eye tracking is enabled:

- Look at the **top 15% of the screen** and the page scrolls up
- Look at the **bottom 15% of the screen** and the page scrolls down
- Look anywhere in the middle and the scrolling stops

### Calibration

The 9-point calibration screen walks you through clicking each dot 5 times while looking at it. A **Recalibrate** button appears after calibration completes, or you can call `GazeTracker.recalibrate()` from the browser console if accuracy drifts.

> **Note:** Real eye tracking requires the site to be served over `http://localhost` or `https://` and the webcam API does not work when opening HTML files directly. TO ensure eye tracking works as expected, use the feature on the hosted website (link has been provided above).

---

## Standards Covered

### WCAG 2.1 — Web Content Accessibility Guidelines

The international technical standard for web accessibility, published by the W3C. Built on four **POUR** principles:

| Principle | Description |
|-----------|-------------|
| **Perceivable** | Content must be presentable in ways users can perceive (alt text, captions, contrast) |
| **Operable** | All functionality must work via keyboard, switch, or voice and not just mouse |
| **Understandable** | Content and UI must be clear, predictable, and resistant against errors |
| **Robust** | Content must work reliably across assistive technologies |

**Conformance levels:** A (minimum) · AA (legal standard, 50 criteria) · AAA (enhanced, 78 criteria)

### Accessible Canada Act (ACA) — 2019

Canada's federal law requiring federally regulated organizations to identify, remove, and prevent accessibility barriers in ICT systems. Enforced by the Accessibility Commissioner.

### AODA / IASR — Ontario

Ontario's Accessibility for Ontarians with Disabilities Act requires public and private sector organizations (50+ employees) to meet WCAG 2.0 Level AA. Directly governs websites and web content.

---

## Technology Stack

| Technology | Purpose |
|-----------|---------|
| **HTML5** | Semantic structure, ARIA roles, landmarks |
| **CSS3** | Custom properties, responsive grid, animations |
| **Vanilla JavaScript** | All interactivity and no frameworks |
| **WebGazer.js v2.1** | Webcam-based real time gaze estimation |
| **Web Speech API** | Screen reader audio announcements |
| **Web Audio API** | Dwell-click feedback tones |
| **sessionStorage** | Accessibility state persistence across pages |
| **Fonts** | Syne (display) · Lora (body) · DM Mono (code/UI) |

---

## Guiding Questions

This project was built around three questions from the Mobilizing Digital Citizenship course:

1. **Developer liability:** How much should developers be liable for ensuring their digital services are accessible to people with different kinds of disabilities?

2. **Digital equality:** How could creating accessibility standards for regulating the internet, similar to other infrastructure, support and increase digital equality and help all people participate in digital communities?

3. **Participation:** How does using accessibility design enable people with disabilities to have a greater chance of participating in digital communities?

---

## Who Benefits

This project was built for:

- **Novice web developers** learning how their design choices affect users with disabilities
- **Designers** exploring inclusive design principles
- **Educators** teaching digital citizenship and accessibility ethics
- **Anyone** curious about how assistive technologies actually work

It can be shared via social media, developer forums, and accessibility awareness events as an interactive learning resource.

---
