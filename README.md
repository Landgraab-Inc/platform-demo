# CENTRUM DEUTSCH · Platform Demo

Public preview build of the CENTRUM DEUTSCH learning platform.

This repository contains only browser-facing demo assets. The working source of truth, database migrations, internal documentation, State Lab and product architecture remain in the private `Landgraab-Inc/platform` repository.

Current preview: A2.1 · Module 01 vertical slice with Supabase Auth, server-backed module structure and saved student answer.

The Supabase publishable key used by the browser is intentionally public. Authorization is enforced by Supabase Auth and Row Level Security; no secret/service-role key belongs in this repository.
