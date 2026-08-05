# Trekking Management Application - Silver Fortnight

The Trekking Management Application is a role-based web platform built to help adventure and trekking organizations move away from spreadsheets, phone calls, and manual coordination. It centralizes trek creation, staff assignment, participant registration, slot management, and booking tracking into a single system.

The application supports three roles:

- **Admin** – the superuser who creates and manages trekking routes, onboards and manages trek staff, assigns staff to treks, oversees all users and bookings, and reviews reports and trekking statistics.
- **Trek Staff** – created by the Admin, staff manage the treks assigned to them: updating available slots, opening/closing treks, tracking completion status, and viewing the list of registered participants.
- **User (Trekker)** – trekkers can register, browse and filter open treks by difficulty, location, or duration, book available slots, and track their booking status and trekking history.

Core system rules include preventing overbooking beyond available slots, restricting trek management to assigned staff only, allowing bookings only on treks marked "Open," and blocking duplicate bookings for the same trek by a user.

The project is built with a Flask API backend, a VueJS frontend, SQLite for persistent storage, and Redis for caching and background job coordination — aimed at giving trekking organizations a lightweight, self-hosted way to run their operations end to end.