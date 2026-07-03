from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from app import db, limiter
from app.models import User
import bcrypt
import re
import logging

bp = Blueprint('auth', __name__)

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, password_hash):
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    if len(password) < 8:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[a-z]', password):
        return False
    if not re.search(r'[0-9]', password):
        return False
    return True

@bp.route('/register', methods=['POST'])
@limiter.limit('5 per hour')
def register():
    data = request.get_json()
    
    required = ['email', 'password', 'name', 'student_id']
    missing = [f for f in required if f not in data]
    if missing:
        return {'error': f'Missing fields: {", ".join(missing)}'}, 400
    
    if not validate_email(data['email']):
        return {'error': 'Invalid email format'}, 400
    
    if not validate_password(data['password']):
        return {'error': 'Password must be at least 8 characters with uppercase, lowercase, and number'}, 400
    
    if User.query.filter_by(email=data['email']).first():
        return {'error': 'Email already registered'}, 409
    
    if User.query.filter_by(student_id=data['student_id']).first():
        return {'error': 'Student ID already registered'}, 409
    
    user = User(
        email=data['email'],
        password_hash=hash_password(data['password']),
        name=data['name'],
        student_id=data['student_id'],
        role='student'
    )
    
    db.session.add(user)
    db.session.commit()
    
    return {'message': 'Registration successful', 'user': user.to_dict()}, 201

@bp.route('/login', methods=['POST'])
@limiter.limit('10 per minute')
def login():
    data = request.get_json()
    
    if 'email' not in data or 'password' not in data:
        return {'error': 'Email and password required'}, 400
    
    user = User.query.filter_by(email=data['email']).first()
    
    if not user or not verify_password(data['password'], user.password_hash):
        return {'error': 'Invalid credentials'}, 401
    
    if not user.is_active:
        return {'error': 'Account is deactivated'}, 403
    
    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    
    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict()
    }, 200

@bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    return {'access_token': access_token}, 200

@bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return {'error': 'User not found'}, 404
    return {'user': user.to_dict()}, 200