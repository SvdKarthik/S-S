from flask import Flask, app
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
import os

load_dotenv()

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address)

def create_app():
    global app
    app = Flask(__name__, 
                static_folder='../../frontend',   # relative path to frontend folder
                static_url_path='')
    
    @app.route('/')
    def index():
        return app.send_static_file('index.html')
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 3600  # 1 hour
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = 86400  # 24 hours
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, origins=os.getenv('FRONTEND_URL', '*'))
    limiter.init_app(app)
    
    # Register blueprints
    from app.routes import auth, lost_found, feedback, events, ai, admin, dashboard
    app.register_blueprint(auth.bp, url_prefix='/api/auth')
    app.register_blueprint(lost_found.bp, url_prefix='/api/lost-found')
    app.register_blueprint(feedback.bp, url_prefix='/api/feedback')
    app.register_blueprint(events.bp, url_prefix='/api/events')
    app.register_blueprint(ai.bp, url_prefix='/api/ai')
    app.register_blueprint(admin.bp, url_prefix='/api/admin')
    app.register_blueprint(dashboard.bp, url_prefix='/api/dashboard')
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(e):
        return {'error': 'Resource not found'}, 404
    
    @app.errorhandler(500)
    def internal_error(e):
        return {'error': 'Internal server error'}, 500
    
    return app