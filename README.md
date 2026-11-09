# Salon Booking

A salon reservation web app for nails, hairdressing, and any custom service categories — with a fast client booking flow and a full provider dashboard.

## Features

**Client booking flow**
- Pick a category → service → staff (or "any available")
- Real available time slots computed from opening hours, staff schedules, breaks, and existing bookings — no double-booking
- Instant in-app confirmation with a booking reference; view or cancel using the reference

**Provider dashboard**
- First-launch setup wizard: business name, categories, services (price + duration), staff, weekly opening hours with breaks and closed days
- Manage services, categories, staff, and hours anytime
- Today's agenda + week calendar; confirm, cancel, or complete bookings; add bookings manually

**Storage**
Data is saved in the browser via localStorage on each device. A demo-data option and reset button are included.

## Run it

Open `index.html` in any modern browser, or visit the GitHub Pages URL (enable Pages in Settings → Pages, deploying from `main` / root).

## Notes

Bookings made on one device are not yet synced across devices — a shared backend is the next planned step. Booking confirmations are in-app only for now.
