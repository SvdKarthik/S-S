from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User, LostItem, FoundItem, Feedback, Event
from app.utils.decorators import admin_required

bp = Blueprint('admin', __name__)

@bp.route('/users', methods=['GET'])
@jwt_required()
@admin_required
def get_users():
    users = User.query.all()
    return {'users': [user.to_dict() for user in users]}, 200

@bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_user(user_id):
    data = request.get_json()
    user = User.query.get(user_id)
    
    if not user:
        return {'error': 'User not found'}, 404
    
    if 'role' in data and data['role'] in ['student', 'admin']:
        user.role = data['role']
    if 'is_active' in data:
        user.is_active = data['is_active']
    
    db.session.commit()
    return {'user': user.to_dict()}, 200

@bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return {'error': 'User not found'}, 404
    
    if user.role == 'admin':
        return {'error': 'Cannot delete admin user'}, 403
    
    db.session.delete(user)
    db.session.commit()
    return {'message': 'User deleted'}, 200