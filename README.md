# Imagify SaaS - Multi-Model AI Image Generator

A FastAPI-based SaaS platform for AI image generation with multi-model support, user management, and credit-based access control.

## Features

- **Multi-Model Support**: Integrated with Hive AI, ZenMux, Google Vertex AI, and Wavespeed AI
- **Image Upscaler**: Wavespeed AI Image Upscaler with 2K/4K/8K resolution support
- **Image Enhancer**: AI-powered image enhancement using Hive AI models
- **User Management**: Register, login, role-based access (admin/user)
- **Credit System**: Credit-based image generation with automatic deduction
- **Generation History**: Track all image generations with status and error messages
- **Responsive UI**: Modern, responsive web interface with dark/light theme support

## Supported Models

### Hive AI Models
- `hive/flux-schnell-enhanced` - Flux Schnell Enhanced
- `hive/flux-schnell-emoji` - Flux Schnell Emoji  
- `hive/sdxl-enhanced` - SDXL Enhanced

### ZenMux/OpenAI-Compatible Models
- Various models via OpenAI-compatible API endpoints

### Wavespeed AI
- `wavespeed-ai/image-upscaler` - Image upscaler (costs 2 credits)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI |
| Database | SQLite (WAL mode) |
| Frontend | Jinja2 templates, HTML/CSS/JS |
| Auth | Session-based authentication |
| AI APIs | Hive AI, ZenMux, Google Vertex AI, Wavespeed AI |

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/exobon/imagify-saas.git
cd imagify-saas
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file in the project root:

```bash
ZENMUX_API_KEY=your_zenmux_api_key
WAVESPEED_API_KEY=your_wavespeed_api_key
```

### 3. Run the Server

```bash
uvicorn main:app --reload
```

The application will be available at `http://localhost:8000`.

## API Endpoints

### Public Routes
- `GET /` - Landing page
- `GET /login` - Login page
- `POST /login` - User login
- `GET /register` - Registration page
- `POST /register` - User registration

### Protected Routes (requires authentication)
- `GET /dashboard` - User dashboard with generation history

### Admin Routes
- `GET /admin` - Admin panel

### API Endpoints
- `POST /api/generate` - Generate image (requires auth)
- `POST /api/admin/credits` - Update user credits (admin only)
- `POST /api/admin/role` - Update user role (admin only)
- `POST /api/admin/delete-user` - Delete user (admin only)
- `POST /api/admin/create-user` - Create new user (admin only)
- `POST /api/admin/settings` - Update API keys and settings (admin only)

## Default Credentials

On first run, a default admin user is created:
- **Username**: `admin`
- **Password**: `admin123`
- **Credits**: 100

> ⚠️ Change the admin password immediately in production!

## Credit System

| Action | Cost |
|--------|------|
| Standard generation | 1 credit |
| Image upscaler | 2 credits |

Users start with 1 credit upon registration.

## Project Structure

```
├── main.py              # FastAPI application and routes
├── database.py          # SQLite database operations
├── requirements.txt     # Python dependencies
├── templates/           # Jinja2 HTML templates
│   ├── landing.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   └── admin.html
├── static/              # Static assets
│   ├── css/styles.css
│   ├── js/app.js
│   ├── images/
│   └── generations/     # Generated images
└── README.md
```

## Configuration

Settings are stored in the database and can be updated via the admin panel:

- `zenmux_api_key` - ZenMux API key for model generation
- `hive_api_key` - Hive AI API key for Hive models
- `wavespeed_api_key` - Wavespeed AI API key for upscaling
- `base_url` - API base URL (default: https://zenmux.ai/api/vertex-ai)
- `protocol` - API protocol (default: vertex-ai)

## Development

### Database Migration

The database is initialized automatically on startup. Key tables:
- `users` - User accounts with credentials and credits
- `sessions` - User sessions for authentication
- `generations` - Image generation records
- `settings` - Application settings/API keys

### Debugging

Check the console for initialization messages, including the default admin credentials printed on first run.

## License

MIT License