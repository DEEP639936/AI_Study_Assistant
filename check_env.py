"""
Run this script to check if your .env file is loading correctly.
Usage: python check_env.py
"""
from utils.config import settings

print("\n" + "=" * 56)
print("  AI Study Assistant — Environment Check")
print("=" * 56)

print("\n  Detected env files:")
if settings.loaded_files:
    for path in settings.loaded_files:
        print(f"  - {path}")
else:
    print("  No .env or .env.txt file found in the app folder or current folder.")

print("\n  Loaded keys:")
for key in ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "GEMINI_MODEL", "PORT"]:
    value = settings.get(key, "") or ""
    if value:
        preview = value if key in {"GEMINI_MODEL", "PORT"} else f"{value[:10]}..."
        print(f"  {key:<15} = {preview}  OK")
    else:
        print(f"  {key:<15} = NOT SET")

print()
if settings.get('GEMINI_API_KEY') or settings.get('GROQ_API_KEY') or settings.get('OPENAI_API_KEY'):
    print("  Result: AI key found. Run python main.py to start the app.")
else:
    print("  Result: NO AI KEY FOUND!")
    print("  Use one of these exact names in your env file:")
    print("    GEMINI_API_KEY=your_key_here")
    print("    GROQ_API_KEY=your_key_here")
    print("    OPENAI_API_KEY=your_key_here")

print("=" * 56 + "\n")
