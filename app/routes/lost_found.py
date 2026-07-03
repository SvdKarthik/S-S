from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, limiter
from app.models import LostItem, FoundItem, User
from app.services.upload import upload_image
from app.utils.decorators import admin_required
from datetime import datetime

bp = Blueprint('lost_found', __name__)

# Lost Items Routes
@bp.route('/lost', methods=['GET'])
def get_lost_items():
    status = request.args.get('status')
    search = request.args.get('search')
    
    query = LostItem.query
    
    if status and status in ['lost', 'found', 'claimed']:
        query = query.filter_by(status=status)
    
    if search:
        query = query.filter(
            db.or_(
                LostItem.title.ilike(f'%{search}%'),
                LostItem.description.ilike(f'%{search}%'),
                LostItem.location.ilike(f'%{search}%')
            )
        )
    
    items = query.order_by(LostItem.created_at.desc()).all()
    return {'items': [item.to_dict() for item in items]}, 200

@bp.route('/lost', methods=['POST'])
@jwt_required()
@limiter.limit('10 per hour')
def create_lost_item():
    user_id = get_jwt_identity()
    data = request.form
    
    required = ['title', 'description']
    missing = [f for f in required if f not in data]
    if missing:
        return {'error': f'Missing fields: {", ".join(missing)}'}, 400
    
    image_url = None
    if 'image' in request.files:
        image_url = upload_image(request.files['image'])
    
    item = LostItem(
        title=data['title'],
        description=data['description'],
        location=data.get('location'),
        date_lost=datetime.strptime(data['date_lost'], '%Y-%m-%d') if data.get('date_lost') else None,
        image_url=image_url,
        user_id=user_id,
        status='lost'
    )
    
    db.session.add(item)
    db.session.commit()
    
    return {'item': item.to_dict()}, 201

@bp.route('/lost/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_lost_item(item_id):
    user_id = get_jwt_identity()
    data = request.get_json()
    
    item = LostItem.query.get(item_id)
    if not item:
        return {'error': 'Item not found'}, 404
    
    if item.user_id != user_id:
        return {'error': 'Permission denied'}, 403
    
    if 'title' in data:
        item.title = data['title']
    if 'description' in data:
        item.description = data['description']
    if 'location' in data:
        item.location = data['location']
    if 'status' in data and data['status'] in ['lost', 'found', 'claimed']:
        item.status = data['status']
        if data['status'] == 'claimed':
            item.resolved_at = datetime.utcnow()
    
    db.session.commit()
    return {'item': item.to_dict()}, 200

@bp.route('/lost/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_lost_item(item_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    item = LostItem.query.get(item_id)
    if not item:
        return {'error': 'Item not found'}, 404
    
    if item.user_id != user_id and user.role != 'admin':
        return {'error': 'Permission denied'}, 403
    
    db.session.delete(item)
    db.session.commit()
    return {'message': 'Item deleted'}, 200

# Found Items Routes
@bp.route('/found', methods=['GET'])
def get_found_items():
    status = request.args.get('status')
    search = request.args.get('search')
    
    query = FoundItem.query
    
    if status and status in ['found', 'claimed']:
        query = query.filter_by(status=status)
    
    if search:
        query = query.filter(
            db.or_(
                FoundItem.title.ilike(f'%{search}%'),
                FoundItem.description.ilike(f'%{search}%'),
                FoundItem.location.ilike(f'%{search}%')
            )
        )
    
    items = query.order_by(FoundItem.created_at.desc()).all()
    return {'items': [item.to_dict() for item in items]}, 200

@bp.route('/found', methods=['POST'])
@jwt_required()
@limiter.limit('10 per hour')
def create_found_item():
    user_id = get_jwt_identity()
    data = request.form
    
    required = ['title', 'description']
    missing = [f for f in required if f not in data]
    if missing:
        return {'error': f'Missing fields: {", ".join(missing)}'}, 400
    
    image_url = None
    if 'image' in request.files:
        image_url = upload_image(request.files['image'])
    
    item = FoundItem(
        title=data['title'],
        description=data['description'],
        location=data.get('location'),
        date_found=datetime.strptime(data['date_found'], '%Y-%m-%d') if data.get('date_found') else None,
        image_url=image_url,
        user_id=user_id,
        status='found'
    )
    
    db.session.add(item)
    db.session.commit()
    
    return {'item': item.to_dict()}, 201

@bp.route('/found/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_found_item(item_id):
    user_id = get_jwt_identity()
    data = request.get_json()
    
    item = FoundItem.query.get(item_id)
    if not item:
        return {'error': 'Item not found'}, 404
    
    if item.user_id != user_id:
        return {'error': 'Permission denied'}, 403
    
    if 'title' in data:
        item.title = data['title']
    if 'description' in data:
        item.description = data['description']
    if 'location' in data:
        item.location = data['location']
    if 'status' in data and data['status'] in ['found', 'claimed']:
        item.status = data['status']
        if data['status'] == 'claimed':
            item.resolved_at = datetime.utcnow()
    
    db.session.commit()
    return {'item': item.to_dict()}, 200

@bp.route('/found/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_found_item(item_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    item = FoundItem.query.get(item_id)
    if not item:
        return {'error': 'Item not found'}, 404
    
    if item.user_id != user_id and user.role != 'admin':
        return {'error': 'Permission denied'}, 403
    
    db.session.delete(item)
    db.session.commit()
    return {'message': 'Item deleted'}, 200