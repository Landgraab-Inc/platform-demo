# CENTRUM DEUTSCH · Platform Demo

Public browser preview of the CENTRUM DEUTSCH learning platform.

This repository contains only browser-facing demo assets. The working source of truth, database migrations, internal documentation, State Lab and product architecture remain in the private `Landgraab-Inc/platform` repository.

Current preview includes:
- Supabase Auth;
- the existing student dashboard and course flow;
- A2.1 → Module 01 → ten clickable module sections;
- previous/next lesson navigation, resume and progress;
- server-backed attempts, open submission and teacher feedback flow;
- teacher workspace routes and minimal admin overview, activated for accounts provisioned with those roles.

The Supabase publishable key used by the browser is intentionally public. Authorization is enforced by Supabase Auth and Row Level Security; no secret/service-role key belongs in this repository.
