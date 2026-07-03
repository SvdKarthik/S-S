from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, limiter
from app.models import Feedback, User
from app.services.sentiment import analyze_sentiment
from app.utils.decorators import admin_required
from datetime import datetime, timedelta

bp = Blueprint('feedback', __name__)

@bp.route('/', methods=['GET'])
def get_feedback():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    sentiment = request.args.get('sentiment')
    category = request.args.get('category')
    
    query = Feedback.query
    
    if sentiment:
        query = query.filter_by(sentiment=sentiment)
    if category:
        query = query.filter_by(category=category)
    
    paginated = query.order_by(Feedback.created_at.desc()).paginate(page=page, per_page=per_page)
    
    return {
        'items': [item.to_dict() for item in paginated.items],
        'total': paginated.total,
        'page': page,
        'pages': paginated.pages
    }, 200

@bp.route('/', methods=['POST'])
@jwt_required()
@limiter.limit('10 per hour')
def create_feedback():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if 'text' not in data or not data['text'].strip():
        return {'error': 'Feedback text is required'}, 400
    
    # Analyze sentiment
    analysis = analyze_sentiment(data['text'])
    
    feedback = Feedback(
        text=data['text'],
        sentiment=analysis['sentiment'],
        sentiment_score=analysis['score'],
        category=data.get('category'),
        user_id=user_id
    )
    
    db.session.add(feedback)
    db.session.commit()
    
    return {'feedback': feedback.to_dict()}, 201

@bp.route('/<int:feedback_id>', methods=['DELETE'])
@jwt_required()
def delete_feedback(feedback_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    feedback = Feedback.query.get(feedback_id)
    if not feedback:
        return {'error': 'Feedback not found'}, 404
    
    if feedback.user_id != user_id and user.role != 'admin':
        return {'error': 'Permission denied'}, 403
    
    db.session.delete(feedback)
    db.session.commit()
    return {'message': 'Feedback deleted'}, 200

@bp.route('/stats', methods=['GET'])
@jwt_required()
def get_feedback_stats():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if user.role != 'admin':
        return {'error': 'Admin access required'}, 403
    
    # Overall stats
    total = Feedback.query.count()
    positive = Feedback.query.filter_by(sentiment='positive').count()
    negative = Feedback.query.filter_by(sentiment='negative').count()
    neutral = Feedback.query.filter_by(sentiment='neutral').count()
    
    # Trends (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent = Feedback.query.filter(Feedback.created_at >= seven_days_ago).all()
    
    daily_trends = {}
    for i in range(7):
        day = seven_days_ago + timedelta(days=i)
        date_key = day.strftime('%Y-%m-%d')
        daily_trends[date_key] = {
            'positive': 0,
            'negative': 0,
            'neutral': 0
        }
    
    for fb in recent:
        date_key = fb.created_at.strftime('%Y-%m-%d')
        if date_key in daily_trends:
            daily_trends[date_key][fb.sentiment] += 1
    
    return {
        'total': total,
        'positive': positive,
        'negative': negative,
        'neutral': neutral,
        'trends': daily_trends
    }, 200