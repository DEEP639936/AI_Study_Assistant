import os
from pathlib import Path
from flask import Flask, render_template, jsonify

from utils.config import settings


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.update(
        MAX_CONTENT_LENGTH=25 * 1024 * 1024,
        SECRET_KEY=settings.get('SECRET_KEY', 'study-assistant-dev-secret'),
        JSON_SORT_KEYS=False,
    )

    os.makedirs(Path(__file__).parent / 'uploads', exist_ok=True)

    from routes.upload import upload_bp
    from routes.chat import chat_bp
    from routes.summarize import summarize_bp
    from routes.quiz import quiz_bp
    from routes.study_tools import study_tools_bp

    app.register_blueprint(upload_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(summarize_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(study_tools_bp)

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.get('/health')
    def health():
        return jsonify({
            'status': 'ok',
            'app': 'AI Study Assistant',
            'provider': (
                'gemini' if settings.get('GEMINI_API_KEY')
                else 'groq' if settings.get('GROQ_API_KEY')
                else 'openai' if settings.get('OPENAI_API_KEY')
                else 'none'
            )
        })

    @app.errorhandler(413)
    def too_large(_):
        return jsonify({'success': False, 'error': 'File too large. Upload a file under 25 MB.'}), 413

    return app


app = create_app()

if __name__ == '__main__':
    port = int(settings.get('PORT', '5000'))
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
