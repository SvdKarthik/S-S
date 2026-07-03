from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, limiter
from app.models import Event, EventVote, User
from app.services.upload import upload_image
from app.utils.decorators import admin_required
from datetime import datetime

bp = Blueprint('events', __name__)

@bp.route('/', methods=['GET'])
def get_events():
    status = request.args.get('status')
    sort_by = request.args.get('sort_by', 'created_at')
    
    query = Event.query
    
    if status:
        query = query.filter_by(status=status)
    
    if sort_by == 'popularity':
        query = query.order_by(db.desc(db.func.count(EventVote.id)))
    else:
        query = query.order_by(Event.created_at.desc())
    
    events = query.all()
    return {'events': [event.to_dict() for event in events]}, 200

@bp.route('/', methods=['POST'])
@jwt_required()
@limiter.limit('5 per hour')
def create_event():
    user_id = get_jwt_identity()
    data = request.form
    
    required = ['title', 'description']
    missing = [f for f in required if f not in data]
    if missing:
        return {'error': f'Missing fields: {", ".join(missing)}'}, 400
    
    image_url = None
    if 'image' in request.files:
        image_url = upload_image(request.files['image'])
    
    event = Event(
        title=data['title'],
        description=data['description'],
        date=datetime.strptime(data['date'], '%Y-%m-%dT%H:%M') if data.get('date') else None,
        venue=data.get('venue'),
        image_url=image_url,
        user_id=user_id,
        status='pending'
    )
    
    db.session.add(event)
    db.session.commit()
    
    return {'event': event.to_dict()}, 201

@bp.route('/<int:event_id>/vote', methods=['POST'])
@jwt_required()
@limiter.limit('20 per hour')
def vote_event(event_id):
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if 'vote_type' not in data or data['vote_type'] not in ['up', 'down']:
        return {'error': 'Valid vote_type (up/down) is required'}, 400
    
    event = Event.query.get(event_id)
    if not event:
        return {'error': 'Event not found'}, 404
    
    # Check if user already voted
    existing_vote = EventVote.query.filter_by(event_id=event_id, user_id=user_id).first()
    if existing_vote:
        existing_vote.vote_type = data['vote_type']
    else:
        vote = EventVote(
            event_id=event_id,
            user_id=user_id,
            vote_type=data['vote_type']
        )
        db.session.add(vote)
    
    db.session.commit()
    return {'message': 'Vote recorded'}, 200

@bp.route('/<int:event_id>/status', methods=['PUT'])
@jwt_required()
@admin_required
def update_event_status(event_id):
    data = request.get_json()
    
    if 'status' not in data or data['status'] not in ['pending', 'approved', 'rejected']:
        return {'error': 'Valid status is required'}, 400
    
    event = Event.query.get(event_id)
    if not event:
        return {'error': 'Event not found'}, 404
    
    event.status = data['status']
    db.session.commit()
    
    return {'event': event.to_dict()}, 200