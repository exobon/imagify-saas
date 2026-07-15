import os
# Load environment variables from .env
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            if line.strip() and not line.startswith("#") and "=" in line:
                k, v = line.strip().split("=", 1)
                os.environ[k.strip()] = v.strip()

import httpx
import uuid
import base64
from datetime import datetime
from fastapi import FastAPI, Request, Form, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

import database

app = FastAPI(title="StockGen SaaS - Multi-Model AI Image Generator")

# Initialize database
database.init_db()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates setup
templates = Jinja2Templates(directory="templates")

# Helper to get current user from cookies
async def get_current_user(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    user = database.get_session_user(session_id)
    return user

async def get_current_user_or_redirect(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Location": "/login"}
        )
    return user

async def get_admin_user_or_redirect(request: Request):
    user = await get_current_user(request)
    if not user or not user["is_admin"]:
        raise HTTPException(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Location": "/login"}
        )
    return user

# Exception handler for redirecting unauthenticated users
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code == status.HTTP_307_TEMPORARY_REDIRECT:
        return RedirectResponse(url=exc.headers.get("Location"))
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

# --- Web Routes ---

@app.get("/", response_class=HTMLResponse)
async def read_landing(request: Request):
    user = await get_current_user(request)
    return templates.TemplateResponse(
        request=request, name="landing.html", context={"user": user}
    )

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    user = await get_current_user(request)
    if user:
        return RedirectResponse(url="/dashboard")
    return templates.TemplateResponse(
        request=request, name="login.html", context={"error": None}
    )

@app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    user = database.get_user_by_username(username)
    if not user or not database.verify_password(password, user["password_hash"], user["salt"]):
        return templates.TemplateResponse(
            request=request, 
            name="login.html", 
            context={"error": "Invalid username or password"}
        )
    
    session_id = database.create_session(user["id"])
    response = RedirectResponse(url="/dashboard", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(key="session_id", value=session_id, httponly=True, max_age=604800, samesite="lax")
    return response

@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    user = await get_current_user(request)
    if user:
        return RedirectResponse(url="/dashboard")
    return templates.TemplateResponse(
        request=request, name="register.html", context={"error": None}
    )

@app.post("/register")
async def register(
    request: Request, 
    username: str = Form(...), 
    email: str = Form(...), 
    password: str = Form(...),
    confirm_password: str = Form(...)
):
    if password != confirm_password:
        return templates.TemplateResponse(
            request=request, 
            name="register.html", 
            context={"error": "Passwords do not match"}
        )
    
    if len(password) < 6:
        return templates.TemplateResponse(
            request=request, 
            name="register.html", 
            context={"error": "Password must be at least 6 characters"}
        )
        
    try:
        # Check if username/email already exists
        existing_user = database.get_user_by_username(username)
        if existing_user:
            return templates.TemplateResponse(
                request=request, 
                name="register.html", 
                context={"error": "Username already taken"}
            )
            
        # Register user with default 1 credit
        database.create_user(username, email, password, credits=1)
        
        # Log them in automatically
        user = database.get_user_by_username(username)
        session_id = database.create_session(user["id"])
        response = RedirectResponse(url="/dashboard", status_code=status.HTTP_303_SEE_OTHER)
        response.set_cookie(key="session_id", value=session_id, httponly=True, max_age=604800, samesite="lax")
        return response
    except Exception as e:
        return templates.TemplateResponse(
            request=request, 
            name="register.html", 
            context={"error": f"Registration failed: {str(e)}"}
        )

@app.get("/logout")
async def logout(request: Request):
    session_id = request.cookies.get("session_id")
    if session_id:
        database.delete_session(session_id)
    response = RedirectResponse(url="/")
    response.delete_cookie("session_id")
    return response

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request, user: dict = Depends(get_current_user_or_redirect)):
    generations = database.get_user_generations(user["id"])
    return templates.TemplateResponse(
        request=request, 
        name="dashboard.html", 
        context={"user": user, "generations": generations}
    )

@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request, admin_user: dict = Depends(get_admin_user_or_redirect)):
    users = database.get_all_users()
    generations = database.get_all_generations()
    
    # Load settings
    api_key = database.get_setting("zenmux_api_key")
    base_url = database.get_setting("base_url") or "https://zenmux.ai/api/vertex-ai"
    protocol = database.get_setting("protocol") or "vertex-ai"
    hive_api_key = database.get_setting("hive_api_key")
    
    return templates.TemplateResponse(
        request=request, 
        name="admin.html", 
        context={
            "user": admin_user, 
            "users": users, 
            "generations": generations,
            "api_key": api_key,
            "base_url": base_url,
            "protocol": protocol,
            "hive_api_key": hive_api_key
        }
    )

# --- API Endpoints ---

class CreditUpdateRequest(BaseModel):
    user_id: int
    credits: int

@app.post("/api/admin/credits")
async def update_credits(data: CreditUpdateRequest, admin_user: dict = Depends(get_admin_user_or_redirect)):
    try:
        user = database.get_user_by_id(data.user_id)
        if not user:
            return JSONResponse(status_code=404, content={"success": False, "message": "User not found"})
        database.update_user_credits(data.user_id, data.credits)
        return {"success": True, "message": f"Successfully updated credits for {user['username']}"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})

class RoleUpdateRequest(BaseModel):
    user_id: int
    is_admin: int

@app.post("/api/admin/role")
async def update_role(data: RoleUpdateRequest, admin_user: dict = Depends(get_admin_user_or_redirect)):
    try:
        if data.user_id == admin_user["id"]:
            return JSONResponse(status_code=400, content={"success": False, "message": "You cannot change your own admin status"})
        user = database.get_user_by_id(data.user_id)
        if not user:
            return JSONResponse(status_code=404, content={"success": False, "message": "User not found"})
        database.update_user_role(data.user_id, data.is_admin)
        return {"success": True, "message": f"Successfully updated role for {user['username']}"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})

class DeleteUserRequest(BaseModel):
    user_id: int

@app.post("/api/admin/delete-user")
async def delete_user(data: DeleteUserRequest, admin_user: dict = Depends(get_admin_user_or_redirect)):
    try:
        if data.user_id == admin_user["id"]:
            return JSONResponse(status_code=400, content={"success": False, "message": "You cannot delete yourself"})
        user = database.get_user_by_id(data.user_id)
        if not user:
            return JSONResponse(status_code=404, content={"success": False, "message": "User not found"})
        database.delete_user(data.user_id)
        return {"success": True, "message": f"Successfully deleted user {user['username']}"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})

class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    credits: int = 1
    is_admin: int = 0

@app.post("/api/admin/create-user")
async def admin_create_user(data: CreateUserRequest, admin_user: dict = Depends(get_admin_user_or_redirect)):
    try:
        # Check if username or email already exists
        existing_user = database.get_user_by_username(data.username)
        if existing_user:
            return JSONResponse(status_code=400, content={"success": False, "message": "Username already taken"})
            
        # Create user
        database.create_user(
            username=data.username,
            email=data.email,
            password=data.password,
            credits=data.credits,
            is_admin=data.is_admin
        )
        return {"success": True, "message": f"Successfully created user {data.username}"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})

class SettingsUpdateRequest(BaseModel):
    api_key: str
    base_url: str
    protocol: str
    hive_api_key: str = ""

@app.post("/api/admin/settings")
async def update_settings(data: SettingsUpdateRequest, admin_user: dict = Depends(get_admin_user_or_redirect)):
    try:
        database.save_setting("zenmux_api_key", data.api_key)
        database.save_setting("base_url", data.base_url)
        database.save_setting("protocol", data.protocol)
        database.save_setting("hive_api_key", data.hive_api_key)
        return {"success": True, "message": "Settings updated successfully"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})

HIVE_MODELS_CONFIG = {
    "hive/flux-schnell-enhanced": {
        "endpoint": "https://api.thehive.ai/api/v3/hive/flux-schnell-enhanced",
        "model_name": "Hive Flux Schnell Enhanced",
        "supported_parameters": [
            "prompt",
            "width",
            "height",
            "num_images",
            "seed",
            "num_inference_steps",
            "output_format",
            "output_quality"
        ]
    },
    "hive/flux-schnell-emoji": {
        "endpoint": "https://api.thehive.ai/api/v3/hive/flux-schnell-emoji",
        "model_name": "Hive Flux Schnell Emoji",
        "supported_parameters": [
            "prompt",
            "width",
            "height",
            "num_images",
            "seed",
            "num_inference_steps"
        ]
    },
    "hive/sdxl-enhanced": {
        "endpoint": "https://api.thehive.ai/api/v3/hive/sdxl-enhanced",
        "model_name": "Hive SDXL Enhanced",
        "supported_parameters": [
            "prompt",
            "negative_prompt",
            "width",
            "height",
            "guidance_scale",
            "num_images",
            "seed",
            "num_inference_steps",
            "output_format",
            "output_quality"
        ]
    }
}

HIVE_DEFAULTS = {
    "width": 1024,
    "height": 1024,
    "num_images": 1,
    "num_inference_steps": 15,
    "output_format": "jpeg",
    "output_quality": 90,
    "guidance_scale": 3.5
}

class GenerationRequest(BaseModel):
    prompt: str
    model: str
    negative_prompt: str | None = None
    width: int | None = None
    height: int | None = None
    guidance_scale: float | None = None
    num_images: int | None = None
    seed: int | None = None
    num_inference_steps: int | None = None
    output_format: str | None = None
    output_quality: int | None = None

@app.post("/api/generate")
async def generate_image(data: GenerationRequest, user: dict = Depends(get_current_user_or_redirect)):
    # 1. Check user credits
    current_credits = user["credits"]
    if current_credits < 1:
        return JSONResponse(status_code=400, content={"success": False, "message": "Insufficient credits. Please contact admin to add credits."})
        
    # 2. Get API config
    is_hive = data.model.startswith("hive/")
    hive_api_key = None
    api_key = None
    base_url = None
    protocol = None
    
    if is_hive:
        hive_api_key = database.get_setting("hive_api_key")
        if not hive_api_key:
            return JSONResponse(status_code=500, content={"success": False, "message": "Hive AI API Key is not configured. Please contact the administrator to set the API Key."})
    else:
        if os.path.exists(".env"):
            with open(".env") as f:
                for line in f:
                    if line.strip() and not line.startswith("#") and "=" in line:
                        k, v = line.strip().split("=", 1)
                        os.environ[k.strip()] = v.strip()
                        
        api_key = os.environ.get("ZENMUX_API_KEY") or database.get_setting("zenmux_api_key")
        if not api_key:
            return JSONResponse(status_code=500, content={"success": False, "message": "API Key is not configured. Please contact the administrator to set the API Key."})
            
        base_url = database.get_setting("base_url") or "https://zenmux.ai/api/vertex-ai"
        protocol = database.get_setting("protocol") or "vertex-ai"
    
    # 3. Deduct credit (refund if fails)
    database.update_user_credits(user["id"], current_credits - 1)
    
    # 4. Save initial generation record
    gen_id = database.save_generation(
        user_id=user["id"],
        prompt=data.prompt,
        model=data.model,
        status="pending"
    )
    
    # 5. Call API
    try:
        if is_hive:
            model_cfg = HIVE_MODELS_CONFIG.get(data.model)
            if not model_cfg:
                raise Exception(f"Unknown Hive model: {data.model}")
                
            endpoint_url = model_cfg["endpoint"]
            supported = model_cfg["supported_parameters"]
            
            # Build input payload
            input_payload = {
                "prompt": data.prompt
            }
            
            # Map parameters
            width = data.width or HIVE_DEFAULTS["width"]
            height = data.height or HIVE_DEFAULTS["height"]
            num_images = data.num_images or HIVE_DEFAULTS["num_images"]
            num_inference_steps = data.num_inference_steps or HIVE_DEFAULTS["num_inference_steps"]
            output_format = data.output_format or HIVE_DEFAULTS["output_format"]
            output_quality = data.output_quality or HIVE_DEFAULTS["output_quality"]
            guidance_scale = data.guidance_scale or HIVE_DEFAULTS["guidance_scale"]
            
            if "width" in supported or "height" in supported:
                input_payload["image_size"] = {
                    "width": width,
                    "height": height
                }
                
            if "num_images" in supported:
                input_payload["num_images"] = num_images
                
            if "num_inference_steps" in supported:
                input_payload["num_inference_steps"] = num_inference_steps
                
            if "output_format" in supported:
                input_payload["output_format"] = output_format
                
            if "output_quality" in supported:
                input_payload["output_quality"] = output_quality
                
            if "guidance_scale" in supported:
                input_payload["guidance_scale"] = guidance_scale
                
            if "negative_prompt" in supported and data.negative_prompt:
                input_payload["negative_prompt"] = data.negative_prompt
                
            if "seed" in supported and data.seed is not None:
                input_payload["seed"] = data.seed
                
            headers = {
                "Authorization": f"Bearer {hive_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "input": input_payload
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(endpoint_url, headers=headers, json=payload)
                
                if response.status_code != 200:
                    raise Exception(f"Hive AI API returned status code {response.status_code}: {response.text}")
                    
                resp_json = response.json()
                
                if "output" in resp_json and len(resp_json["output"]) > 0:
                    item = resp_json["output"][0]
                    if "url" in item:
                        img_url = item["url"]
                        # Let's download it to keep local copy
                        img_resp = await client.get(img_url)
                        if img_resp.status_code == 200:
                            filename = f"gen_{user['id']}_{uuid.uuid4().hex[:8]}_{int(datetime.now().timestamp())}.png"
                            filepath = os.path.join("static", "generations", filename)
                            with open(filepath, "wb") as f:
                                f.write(img_resp.content)
                            local_url = f"/static/generations/{filename}"
                            database.update_generation(gen_id, "completed", local_url)
                            return {"success": True, "image_url": local_url, "credits_left": current_credits - 1}
                        else:
                            database.update_generation(gen_id, "completed", img_url)
                            return {"success": True, "image_url": img_url, "credits_left": current_credits - 1}
                            
                raise Exception(f"Could not parse image data from response: {resp_json}")
                
        elif protocol == "vertex-ai":
            from google import genai
            from google.genai import types
            import asyncio
            
            if "ZENMUX_API_KEY" not in os.environ or not os.environ["ZENMUX_API_KEY"]:
                os.environ["ZENMUX_API_KEY"] = api_key
                
            # Determine API version path dynamically based on model routing requirements
            api_version = "v1"
            if data.model in ["baidu/ernie-image-turbo", "bytedance/doubao-seedream-5.0-lite", "stabilityai/sdxl", "black-forest-labs/flux-schnell"]:
                api_version = "v1/projects/zenmux-project/locations/us-central1"
                
                
            sdk_client = genai.Client(
                api_key=os.environ["ZENMUX_API_KEY"],
                vertexai=True,
                http_options=types.HttpOptions(
                    api_version=api_version,
                    base_url="https://zenmux.ai/api/vertex-ai"
                )
            )
            
            # Call generate_images in executor to prevent blocking
            response = await asyncio.get_running_loop().run_in_executor(
                None,
                lambda: sdk_client.models.generate_images(
                    model=data.model,
                    prompt=data.prompt
                )
            )
            
            if response.generated_images and len(response.generated_images) > 0:
                gen_img = response.generated_images[0]
                if gen_img.image:
                    image_data = None
                    if gen_img.image.image_bytes:
                        image_data = gen_img.image.image_bytes
                    elif gen_img.image.gcs_uri:
                        # GCS URI is returned as a public HTTP URL from ZenMux
                        async with httpx.AsyncClient() as downloader:
                            img_resp = await downloader.get(gen_img.image.gcs_uri)
                            if img_resp.status_code == 200:
                                image_data = img_resp.content
                                
                    if image_data:
                        filename = f"gen_{user['id']}_{uuid.uuid4().hex[:8]}_{int(datetime.now().timestamp())}.png"
                        filepath = os.path.join("static", "generations", filename)
                        
                        with open(filepath, "wb") as f:
                            f.write(image_data)
                            
                        local_url = f"/static/generations/{filename}"
                        database.update_generation(gen_id, "completed", local_url)
                        return {"success": True, "image_url": local_url, "credits_left": current_credits - 1}
                        
            raise Exception("No image was returned in the response.")
            
        else:
            # OpenAI-compatible protocol format
            # Endpoint structure: {base_url}/images/generations or if base_url doesn't end with /v1, standard zenmux endpoint
            endpoint_url = base_url
            if "/images/generations" not in endpoint_url:
                endpoint_url = f"{base_url.rstrip('/')}/images/generations" if "/v1" in base_url else "https://zenmux.ai/api/v1/images/generations"
                
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": data.model,
                "prompt": data.prompt,
                "n": 1,
                "size": "1024x1024"
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(endpoint_url, headers=headers, json=payload)
                
                if response.status_code != 200:
                    raise Exception(f"Zenmux OpenAI API returned status code {response.status_code}: {response.text}")
                    
                resp_json = response.json()
                
                if "data" in resp_json and len(resp_json["data"]) > 0:
                    item = resp_json["data"][0]
                    if "url" in item:
                        img_url = item["url"]
                        # Let's download it to keep local copy
                        img_resp = await client.get(img_url)
                        if img_resp.status_code == 200:
                            filename = f"gen_{user['id']}_{uuid.uuid4().hex[:8]}_{int(datetime.now().timestamp())}.png"
                            filepath = os.path.join("static", "generations", filename)
                            with open(filepath, "wb") as f:
                                f.write(img_resp.content)
                            local_url = f"/static/generations/{filename}"
                            database.update_generation(gen_id, "completed", local_url)
                            return {"success": True, "image_url": local_url, "credits_left": current_credits - 1}
                        else:
                            database.update_generation(gen_id, "completed", img_url)
                            return {"success": True, "image_url": img_url, "credits_left": current_credits - 1}
                    elif "b64_json" in item:
                        b64_data = item["b64_json"]
                        image_bytes = base64.b64decode(b64_data)
                        filename = f"gen_{user['id']}_{uuid.uuid4().hex[:8]}_{int(datetime.now().timestamp())}.png"
                        filepath = os.path.join("static", "generations", filename)
                        with open(filepath, "wb") as f:
                            f.write(image_bytes)
                        local_url = f"/static/generations/{filename}"
                        database.update_generation(gen_id, "completed", local_url)
                        return {"success": True, "image_url": local_url, "credits_left": current_credits - 1}
                        
                raise Exception(f"Could not parse image data from response: {resp_json}")
                
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Refund credit
        database.update_user_credits(user["id"], current_credits)
        # Update generation status
        error_msg = str(e)
        database.update_generation(gen_id, "failed", error_message=error_msg[:255])
        return JSONResponse(status_code=500, content={"success": False, "message": f"Generation failed: {error_msg}"})
