# StockGen SaaS - Multi-Model AI Image Generator Knowledge Base

Welcome to the **StockGen** project knowledge base. This file serves as the definitive **single source of truth** for developers and AI agents. It covers the system architecture, technology stack, backend/frontend setup, database schema, APIs, security parameters, and deployment workflows.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Environment & Configurations](#environment--configurations)
5. [Installation & Setup](#installation--setup)
6. [Development Workflow](#development-workflow)
7. [Deployment](#deployment)
8. [Database Schema](#database-schema)
9. [APIs Reference](#apis-reference)
10. [Authentication & Roles](#authentication--roles)
11. [UI Structure](#ui-structure)
12. [Features Deep Dive](#features-deep-dive)
13. [Business Logic & Calculations](#business-logic--calculations)
14. [Coding Standards](#coding-standards)
15. [Security Controls](#security-controls)
16. [Performance Optimization](#performance-optimization)
17. [AI Models & Integrations](#ai-models--integrations)
18. [Troubleshooting & FAQs](#troubleshooting--faqs)
19. [Roadmap & Limitations](#roadmap--limitations)
20. [AI Agent Instructions](#ai-agent-instructions)

---

## Project Overview

### Project Name
* **StockGen** (internally structured as `imagify-saas`)

### Purpose
StockGen is a next-generation SaaS application that unifies multiple third-party AI image generation providers into a single web workspace. It abstracts API keys, pricing, and varying payload schemas behind a uniform user dashboard and a simple pay-as-you-go credit-based billing system.

### Business Goal
* Simplify multi-model AI generation for creators by charging a flat credit value per generation.
* Retain users through an interactive, local gallery that doesn't suffer from expired third-party image URLs.
* Facilitate administrator-mediated credit top-ups with a manual billing workflow (WhatsApp redirect).

### Target Users
* Digital content creators, stock image publishers, web designers, and marketing teams.

### Core Features
* **Multi-Engine Workspace:** Switch instantly between premium models (ZenMux engines and white-labeled DiGi AI engines) via a sidebar selector.
* **Local Copy Caching:** Automatically downloads generated images from CDN locations onto local VPS storage to prevent link expiration.
* **Responsive Gallery:** Search, download, and copy prompts of previous creations with real-time DOM additions.
* **Credit Safeguard:** Automatically deducts credits before calling APIs, but executes refunds if generation fails.
* **Unified Admin Panel:** Allows administrators to modify user credits, manage user roles, delete users, and securely configure API keys.

---

## Architecture

### Complete Folder Structure
```
/home/ubuntu/imagify-saas/
├── database.py             # SQLite DB schemas and interaction helpers
├── main.py                 # FastAPI Web & API Router + application logic
├── requirements.txt        # Python dependency manifest
├── .env                    # Local environment settings (keys override)
├── stockgen.db             # Active SQLite database (auto-created)
├── static/                 # Static asset delivery root
│   ├── css/
│   │   └── styles.css      # Core visual stylesheet
│   ├── generations/        # Cached local output images
│   ├── images/             # System images (brand logo, enhancer assets)
│   │   └── logo.webp       # Current default brand logo
│   └── js/
│       └── app.js          # Core frontend framework
├── templates/              # HTML documents (Jinja2 syntax)
│   ├── admin.html          # Administrative dashboard
│   ├── dashboard.html      # User generation workspace
│   ├── landing.html        # Brand landing page (primary)
│   ├── landing.htm         # Synced static fallback landing page
│   ├── login.html          # Authentication entry page
│   └── register.html       # Signup page
└── scratch/                # System config files & test scripts
    ├── nginx_stockgen.conf # Config file for Nginx reverse proxy
    └── stockgen.service    # systemd system service manifest
```

### Major Directories
* **`templates/`**: Hosts HTML files populated via Jinja2 engine contexts. Contains web routes for user flows (`dashboard`), admin controls (`admin`), registration, and login.
* **`static/`**: Houses frontend CSS, client JS scripts, and system graphics. The subdirectory `static/generations/` is where the application stores all downloaded generated PNG/JPEG images.
* **`scratch/`**: Holds testing utilities and server infrastructure configuration blueprints (Systemd services and Nginx configuration templates).

### Application Flow
```
[User Dashboard]  ───(AJAX Prompt & Model)───>  [FastAPI Backend /api/generate]
       ▲                                                    │
       │ (JSON Response with local URL)                     ▼ (Credit Check)
       │                                            [Deduct 1 Credit]
       │                                                    │
       │                                                    ▼ (Identify Model Provider)
       │                                            ┌───────┴───────┐
       │                                            ▼               ▼
       │                                        [ZenMux]        [DiGi AI]
       │                                            │               │
       │                                            ▼               ▼
       │                                       (Vertex/OAI)    (Hive V3 REST)
       │                                            │               │
       │                                            └───────┬───────┘
       │                                                    ▼
       │                                           [API Returns CDN URL]
       │                                                    │
       │                                                    ▼ (HTTP Client Download)
       │                                            [Save to generations/]
       │                                                    │
       │                                                    ▼ (Write to DB)
 [Update Gallery & Showcase] <───(API Response)─── [Update Generation to 'completed']
```

---

## Technology Stack

* **Programming Language:** Python 3.12+ (Backend), Vanilla JavaScript ES6 (Frontend).
* **Web Framework:** FastAPI (Asynchronous Server Gateway Interface).
* **ASGI Server:** Uvicorn.
* **Template Engine:** Jinja2.
* **HTTP Client:** HTTPX (async requests to external endpoints).
* **Database:** SQLite (local SQL engine using Python's standard `sqlite3` library).
* **Image Processing:** Pillow (Python Imaging Library).
* **Google GenAI SDK:** Used to manage predictions targeting Vertex AI protocols on the ZenMux gateway.
* **Styling (CSS):** Custom vanilla CSS using a uniform dark theme system, gradients, custom scrollbars, and responsiveness. No heavy frameworks (Bootstrap, Tailwind) are loaded, ensuring lightning-fast client loading.

---

## Environment & Configurations

All configurations are stored in the SQLite database `settings` table or loaded from `.env` overrides.

| Variable Name | Purpose | Required Value | Security Level |
| :--- | :--- | :--- | :--- |
| `ZENMUX_API_KEY` | Authentication bearer token for ZenMux proxy endpoints. | String (format: `sk-ai-v1-...`) | **High**. Must never be exposed to clients. |
| `hive_api_key` | Authentication key used for DiGi AI (Hive AI backend) APIs. | String (Bearer Token) | **Critical**. Kept backend-only; masked in the admin dashboard. |
| `base_url` | Base endpoint router for ZenMux OpenAI-compatible calls. | E.g., `https://zenmux.ai/api/v1` | **Medium**. |
| `protocol` | Format resolver for ZenMux APIs (`vertex-ai` or `openai`). | `vertex-ai` or `openai` | **Low**. |

*Note: The SQLite `settings` table utilizes a simple Key-Value structure allowing administrators to save new configuration options without schema changes.*

---

## Installation & Setup

Documented setup steps for fresh virtual private servers (VPS):

### 1. OS System Requirements
* Ubuntu 22.04 LTS or newer.
* Installed system packages: `python3-venv`, `python3-dev`, `sqlite3`, `curl`, `nginx`.

### 2. Dependency Setup
```bash
# Clone the repository and enter directory
cd /home/ubuntu/imagify-saas

# Initialize Python Virtual Environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in `/home/ubuntu/imagify-saas/` with the default ZenMux credentials:
```ini
ZENMUX_API_KEY=sk-ai-v1-xxxxxxxxxxxxxxxxx
```

### 4. Database Setup & Initialization
FastAPI automatically initializes the database schema, default credentials, and configurations on startup:
```python
# From python context:
import database
database.init_db()
```
* **Default Admin Account:**
  * Username: `admin`
  * Password: `admin123`
  * Default Credits: `100`
  * Role: `is_admin = 1`

### 5. Media Folders
Ensure media output directories exist with proper write permissions:
```bash
mkdir -p static/generations
chmod -R 775 static/generations
```

---

## Development Workflow

### Starting the Development Server
Ensure you are inside the virtual environment and launch `uvicorn`:
```bash
source venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Running Test Scripts
Test scripts reside under `scratch/`:
* Call ZenMux vertex models test: `python scratch/test_api.py`
* Call ZenMux OpenAI-compatible models test: `python scratch/test_gpt_image.py`

### Inspecting Local DB State
Query SQLite tables from command line:
```bash
sqlite3 stockgen.db "SELECT id, username, credits, is_admin FROM users;"
```

---

## Deployment

The system is configured to run behind Nginx as a reverse proxy, managed by `systemd`.

### 1. Systemd Configuration
Deploy the service file `/home/ubuntu/imagify-saas/scratch/stockgen.service` into `/etc/systemd/system/`:
```bash
sudo cp scratch/stockgen.service /etc/systemd/system/stockgen.service
sudo systemctl daemon-reload
sudo systemctl enable stockgen
sudo systemctl start stockgen
```

### 2. Reverse Proxy Setup (Nginx)
Configure Nginx using the configuration file in `scratch/nginx_stockgen.conf`. Place it in `/etc/nginx/sites-available/` and symlink to `sites-enabled`:
```nginx
server {
    listen 80;
    server_name _; # Enter server domain here

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static {
        alias /home/ubuntu/imagify-saas/static;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

### 3. Server Management Commands
* **Restart app:** `sudo systemctl restart stockgen`
* **Check logs:** `journalctl -u stockgen -f --no-tail`
* **Nginx reload:** `sudo systemctl reload nginx`

---

## Database Schema

Active Database: `/home/ubuntu/imagify-saas/stockgen.db`

### Entity Relationship Diagram
```
  ┌──────────────┐          ┌──────────────┐
  │    users     │          │   sessions   │
  ├──────────────┤          ├──────────────┤
  │ id (PK)      │ <─────── │ id (PK)      │
  │ username     │          │ user_id (FK) │
  │ email        │          │ created_at   │
  │ password_hash│          │ expires_at   │
  │ salt         │          └──────────────┘
  │ credits      │
  │ is_admin     │          ┌──────────────┐
  │ created_at   │          │ generations  │
  └──────────────┘          ├──────────────┤
         │                  │ id (PK)      │
         └────────────────> │ user_id (FK) │
                            │ prompt       │
                            │ model        │
                            │ image_url    │
                            │ status       │
                            │ error_message│
                            │ created_at   │
                            └──────────────┘
```

### Schema DDL Statements
1. **Users Table**
   ```sql
   CREATE TABLE users (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       username TEXT UNIQUE NOT NULL,
       email TEXT UNIQUE NOT NULL,
       password_hash TEXT NOT NULL,
       salt TEXT NOT NULL,
       credits INTEGER DEFAULT 1,
       is_admin INTEGER DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```
2. **Sessions Table**
   ```sql
   CREATE TABLE sessions (
       id TEXT PRIMARY KEY,
       user_id INTEGER NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       expires_at TIMESTAMP NOT NULL,
       FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
   );
   ```
3. **Generations Table**
   ```sql
   CREATE TABLE generations (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER NOT NULL,
       prompt TEXT NOT NULL,
       model TEXT NOT NULL,
       image_url TEXT,
       status TEXT NOT NULL,
       error_message TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
   );
   ```
4. **Settings Table**
   ```sql
   CREATE TABLE settings (
       key TEXT PRIMARY KEY,
       value TEXT
   );
   ```

---

## APIs Reference

All API payloads use JSON format. Session cookies (`session_id`) must accompany all requests.

### User Endpoint
* **Generate Image**
  * **URL:** `/api/generate`
  * **Method:** `POST`
  * **Authentication:** Required (User Session Cookie)
  * **Request Body:**
    ```json
    {
      "prompt": "A scenic view of oceans",
      "model": "hive/flux-schnell-enhanced",
      "negative_prompt": null,
      "width": 1024,
      "height": 1024,
      "guidance_scale": null,
      "num_images": 1,
      "seed": null,
      "num_inference_steps": 15,
      "output_format": "jpeg",
      "output_quality": 90
    }
    ```
  * **Response (Success - 200 OK):**
    ```json
    {
      "success": true,
      "image_url": "/static/generations/gen_1_5a2f893d_1783441617.png",
      "credits_left": 99
    }
    ```
  * **Response (Insufficient Credits - 400 Bad Request):**
    ```json
    {
      "success": false,
      "message": "Insufficient credits. Please contact admin to add credits."
    }
    ```

### Administrative Endpoints (Admin Session Cookie Required)
* **Update Credits**
  * **URL:** `/api/admin/credits` | `POST`
  * **Request:** `{"user_id": 2, "credits": 50}`
  * **Response:** `{"success": true, "message": "Successfully updated credits for username"}`
* **Update Admin Role**
  * **URL:** `/api/admin/role` | `POST`
  * **Request:** `{"user_id": 2, "is_admin": 1}`
* **Delete User**
  * **URL:** `/api/admin/delete-user` | `POST`
  * **Request:** `{"user_id": 2}`
* **Create User**
  * **URL:** `/api/admin/create-user` | `POST`
  * **Request:** `{"username": "user", "email": "a@b.com", "password": "pwd", "credits": 10, "is_admin": 0}`
* **Save Settings**
  * **URL:** `/api/admin/settings` | `POST`
  * **Request:**
    ```json
    {
      "api_key": "zenmux_key",
      "hive_api_key": "hive_key",
      "base_url": "https://...",
      "protocol": "vertex-ai"
    }
    ```

---

## Authentication & Roles

* **Session Validation:** Cookied-based sessions. Session IDs are generated securely (`secrets.token_urlsafe(32)`) and stored in the database with an expiration date (default: 7 days).
* **Password Security:** Multi-round cryptographic hashing using `hashlib.pbkdf2_hmac` with dynamic 16-byte user-specific salts.
* **Role Check Middleware:**
  * `get_current_user_or_redirect`: Fetches user by checking session cookie. If session is missing or expired, redirects client to `/login`.
  * `get_admin_user_or_redirect`: Validates session and checks if the user has `is_admin = 1` set. Restricts unauthorized redirects.

---

## UI Structure

The UI utilizes custom dark theme variables and a glassmorphic aesthetic (frosted glass elements, neon glow backgrounds, and transitions).

### Pages Map
* **`/` (Landing Page):** Showcases features, unified catalog of eight models, pricing tiers, and direct login entry paths.
* **`/login` & `/register`:** Minimal authentication containers styled with custom alert overlays.
* **`/dashboard`:** Creator studio layout containing:
  * Left sidebar: User status badge, input text area for prompt, model collection grid.
  * Right layout: Live Showcase preview window, local Download & Copy buttons, and previous creation History grid.
* **`/admin`:** Admin Control Center split into tabbed menus:
  * Users panel: Search, list, create users, toggle roles, and edit credit values.
  * Settings panel: Configure ZenMux and DiGi AI parameters.
  * Generations list: Full monitoring log of user requests, statuses, and fail logs.

---

## Features Deep Dive

### manual Credits Payment System
* **Purpose:** Allows users to purchase additional credits.
* **Workflow:** In the credits modal, users select a tier ($5 Starter for 200 credits, $10 Popular for 400 credits, or $20 Pro for 800 credits). Clicking "Buy Now" redirects them to a WhatsApp direct link pre-populated with a purchase request message containing their username. The administrator manually verifies the transaction and updates their balance in the Admin Panel.

---

## Business Logic & Calculations

### Credit Consumption
* **Cost:** Each generation costs exactly `1` credit.
* **Credit Check:** The database is queried for current user credits. If `credits < 1`, execution is blocked and the request fails.
* **Deduction and Refund Loop:**
  1. Credit is deducted: `credits = credits - 1`.
  2. Generation logs status: `pending`.
  3. External call is executed.
  4. On successful call, status becomes `completed`.
  5. On exception/timeout, status updates to `failed` and credits are refunded: `credits = credits + 1`.

---

## Coding Standards

* **Python Style:** Follow PEP-8. Utilize async/await syntax for IO bounds. Implement clean database connection scoping (always close connection in a `finally` block).
* **JavaScript Conventions:** Maintain ES6 conventions. Separate modular utility helpers (such as `getModelDisplayName`). Use strict DOM element presence checks before binding events.
* **Naming:** Use snake_case for Python parameters/functions, camelCase for JavaScript variables, and kebab-case for CSS selectors and HTML element IDs.

---

## Security Controls

* **Frontend Protection:** All credentials (API keys) are kept server-side. The dashboard never references private keys or routes that can expose database tables.
* **Input Sanitization:** Standard SQL query parameterization (`?` placeholders) is utilized globally to prevent SQL injection.
* **Cross-Site Session Hijacking:** Cookies are configured with `httponly=True` and `samesite="lax"`.
* **Credential Masking:** The `settings-hive-api-key` field inside the admin panel renders as a masked password type (`type="password"`).

---

## Performance Optimization

* **Local Mirroring:** The backend automatically pulls target images from foreign CDNs and writes them locally into `static/generations/`. This prevents broken images when CDN links expire.
* **Concurrency:** FastAPI routes leverage asynchronous event loops, preventing thread blocking during HTTP calls to external provider APIs.

---

## AI Models & Integrations

The system categorizes AI models into two distinct integration groups:

```
                  ┌──────────────────────────────────────────────┐
                  │                 Select Model                 │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     ┌──────────────────────┐                        ┌──────────────────────┐
     │      ZenMux AI       │                        │       DiGi AI        │
     └──────────┬───────────┘                        └──────────┬───────────┘
                │                                               │
     ┌──────────┴───────────┐                        ┌──────────┴───────────┐
     ├ Kling V2             ┤                        ├ DiGi Vision Pro      ┤
     ├ Hunyuan V3.0         ┤                        ├ DiGi Emoji Studio    ┤
     ├ GLM Image            ┤                        ├ DiGi Canvas Pro      ┤
     ├ Doubao Seedream      ┤                        └──────────────────────┘
     ├ Ernie Image Turbo    ┤
     ├ Flux Schnell         ┤
     ├ Stable Diffusion XL  ┤
     └──────────────────────┘
```

### 1. ZenMux Engines (Vertex / OpenAI gateway)
* Supported protocol: Vertex AI predict protocols (using `google-genai` SDK) or OpenAI compatible formats.
* Custom routing paths are selected dynamically based on model names (e.g., using `v1/projects/zenmux-project/locations/us-central1` for Ernie, Doubao, Flux Schnell, and SDXL).

### 2. DiGi AI Engines (Hive AI V3 REST backend)
* Authentic Model Slugs (Internal API calls):
  * **DiGi Vision Pro:** `hive/flux-schnell-enhanced`
  * **DiGi Emoji Studio:** `hive/flux-schnell-emoji`
  * **DiGi Canvas Pro:** `hive/sdxl-enhanced`
* Payload structure:
  ```json
  {
    "input": {
      "prompt": "...",
      "image_size": {
        "width": 1024,
        "height": 1024
      },
      ...
    }
  }
  ```
* Output URL Parsing: Resolves `response.output[0].url` from JSON response.

---

## Troubleshooting & FAQs

### Error: "Invalid or expired token" (Status: 401) on DiGi Models
* **Cause:** The stored `hive_api_key` is incorrect or expired.
* **Fix:** Log in as administrator, navigate to Settings, enter a valid Hive API key in the **DiGi AI API Key** input, and save.

### Empty Showcase Screen
* **Cause:** Generated image failed to download locally (network timeout or local storage out of space).
* **Fix:** Check console logs and ensure `static/generations` has write permissions (`chmod -R 775`).

---

## Roadmap & Limitations

### Known Limitations
* Image formats are limited to `png` and `jpeg`.
* Credit purchases are manual; payment gateways (Stripe/PayPal) are not natively integrated.

### Roadmap
* Implement automated Stripe webhook listener.
* Add native image aspect-ratio selector controls in the dashboard.

---

## AI Agent Instructions

When editing the **StockGen** application codebase, future AI agents **must** adhere to the following rules:

1. **Keep Slugs Hidden:** Ensure `hive/` slugs and references to `Hive AI` are kept strictly backend-only. The frontend must only display **DiGi AI**, **DiGi Vision Pro**, **DiGi Emoji Studio**, and **DiGi Canvas Pro**.
2. **Never Expose Credentials:** Ensure API keys are loaded from settings database or environment variables. Never print or store plaintext keys in code or frontend scripts.
3. **Prevent SQL Injections:** Always use parameter binding (`?` query inputs) for all SQLite transactions.
4. **Maintain Credit Logic:** Always guarantee that credit deduction happens prior to call execution, and that failures trigger database status updates and immediate credit refunds.
5. **Static File Integrity:** Download generated images locally to preserve gallery image rendering.
6. **Backward Compatibility:** Never modify existing working routes, endpoints, or models unless explicitly requested.
7. **Clean Restart:** Always run `sudo systemctl restart stockgen` to apply changes to the live web app environment after code updates.
