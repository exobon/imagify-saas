import sqlite3
import os
import hashlib
import secrets
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "stockgen.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        # WAL mode allows concurrent readers + one writer (fixes "database is locked")
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
        conn.execute("PRAGMA synchronous=NORMAL")
    except sqlite3.DatabaseError:
        pass
    return conn

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        bytes.fromhex(salt),
        100000
    ).hex()
    return pwd_hash, salt

def verify_password(password: str, pwd_hash: str, salt: str) -> bool:
    new_hash, _ = hash_password(password, salt)
    return new_hash == pwd_hash

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        credits INTEGER DEFAULT 1,
        is_admin INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create Sessions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    ''')
    
    # Create Generations table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS generations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        model TEXT NOT NULL,
        image_url TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    ''')
    
    # Create Settings table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')
    
    conn.commit()
    
    # Check if there is an admin user
    cursor.execute("SELECT * FROM users WHERE is_admin = 1")
    admin = cursor.fetchone()
    if not admin:
        # Create default admin
        admin_pass = "admin123"
        pwd_hash, salt = hash_password(admin_pass)
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, salt, credits, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
            ("admin", "admin@stockgen.ai", pwd_hash, salt, 100, 1)
        )
        conn.commit()
        print(f"Created default admin user: username=admin, password={admin_pass}")

    # Check if default API key exists in env and insert if settings empty
    cursor.execute("SELECT * FROM settings WHERE key = 'zenmux_api_key'")
    setting = cursor.fetchone()
    if not setting:
        env_key = os.environ.get("ZENMUX_API_KEY", "")
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("zenmux_api_key", env_key))
        conn.commit()
        
    conn.close()

def create_user(username, email, password, credits=1, is_admin=0):
    conn = get_db_connection()
    cursor = conn.cursor()
    pwd_hash, salt = hash_password(password)
    try:
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, salt, credits, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
            (username, email, pwd_hash, salt, credits, is_admin)
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return user_id
    except sqlite3.IntegrityError as e:
        conn.close()
        raise e

def get_user_by_username(username):
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return user

def get_user_by_id(user_id):
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return user

def get_all_users():
    conn = get_db_connection()
    users = conn.execute("SELECT id, username, email, credits, is_admin, created_at FROM users ORDER BY created_at DESC").fetchall()
    conn.close()
    return users

def update_user_credits(user_id, credits):
    conn = get_db_connection()
    conn.execute("UPDATE users SET credits = ? WHERE id = ?", (credits, user_id))
    conn.commit()
    conn.close()

def update_user_role(user_id, is_admin):
    conn = get_db_connection()
    conn.execute("UPDATE users SET is_admin = ? WHERE id = ?", (is_admin, user_id))
    conn.commit()
    conn.close()

def delete_user(user_id):
    conn = get_db_connection()
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

def create_session(user_id, duration_days=7):
    conn = get_db_connection()
    session_id = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(days=duration_days)
    conn.execute(
        "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
        (session_id, user_id, expires_at.isoformat())
    )
    conn.commit()
    conn.close()
    return session_id

def get_session_user(session_id):
    if not session_id:
        return None
    conn = get_db_connection()
    # Find session and ensure it is not expired
    session = conn.execute(
        "SELECT * FROM sessions WHERE id = ?", (session_id,)
    ).fetchone()
    if not session:
        conn.close()
        return None
        
    expires_at = datetime.fromisoformat(session["expires_at"])
    if expires_at < datetime.now():
        # Session expired, delete it
        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        conn.commit()
        conn.close()
        return None
        
    user = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    conn.close()
    return user

def delete_session(session_id):
    conn = get_db_connection()
    conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()

def save_generation(user_id, prompt, model, image_url=None, status="pending", error_message=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO generations (user_id, prompt, model, image_url, status, error_message) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, prompt, model, image_url, status, error_message)
    )
    conn.commit()
    gen_id = cursor.lastrowid
    conn.close()
    return gen_id

def update_generation(gen_id, status, image_url=None, error_message=None):
    conn = get_db_connection()
    conn.execute(
        "UPDATE generations SET status = ?, image_url = ?, error_message = ? WHERE id = ?",
        (status, image_url, error_message, gen_id)
    )
    conn.commit()
    conn.close()

def get_user_generations(user_id):
    conn = get_db_connection()
    generations = conn.execute(
        "SELECT * FROM generations WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
    ).fetchall()
    conn.close()
    return generations

def get_all_generations():
    conn = get_db_connection()
    generations = conn.execute(
        """SELECT g.*, u.username 
           FROM generations g 
           JOIN users u ON g.user_id = u.id 
           ORDER BY g.created_at DESC"""
    ).fetchall()
    conn.close()
    return generations

def get_setting(key):
    conn = get_db_connection()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else ""

def save_setting(key, value):
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value)
    )
    conn.commit()
    conn.close()
