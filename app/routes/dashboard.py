from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User, LostItem, FoundItem, Feedback, Event
from app.utils.decorators import admin_required
from sqlalchemy import func
from datetime import datetime, timedelta

bp = Blueprint('dashboard', __name__)

@bp.route('/stats', methods=['GET'])
@jwt_required()
@admin_required
def get_stats():
    # Basic counts
    total_users = User.query.count()
    total_lost = LostItem.query.count()
    total_found = FoundItem.query.count()
    total_feedback = Feedback.query.count()
    total_events = Event.query.count()
    
    # Lost vs Found by status
    lost_status = {
        'lost': LostItem.query.filter_by(status='lost').count(),
        'found': LostItem.query.filter_by(status='found').count(),
        'claimed': LostItem.query.filter_by(status='claimed').count()
    }
    
    # Feedback sentiment distribution
    sentiment_stats = {
        'positive': Feedback.query.filter_by(sentiment='positive').count(),
        'negative': Feedback.query.filter_by(sentiment='negative').count(),
        'neutral': Feedback.query.filter_by(sentiment='neutral').count()
    }
    
    # Monthly activity (last 6 months)
    monthly_activity = {}
    for i in range(6):
        month = datetime.utcnow() - timedelta(days=30*i)
        month_key = month.strftime('%Y-%m')
        
        lost_count = LostItem.query.filter(
            func.extract('year', LostItem.created_at) == month.year,
            func.extract('month', LostItem.created_at) == month.month
        ).count()
        
        found_count = FoundItem.query.filter(
            func.extract('year', FoundItem.created_at) == month.year,
            func.extract('month', FoundItem.created_at) == month.month
        ).count()
        
        feedback_count = Feedback.query.filter(
            func.extract('year', Feedback.created_at) == month.year,
            func.extract('month', Feedback.created_at) == month.month
        ).count()
        
        monthly_activity[month_key] = {
            'lost': lost_count,
            'found': found_count,
            'feedback': feedback_count
        }
    
    return {
        'total_users': total_users,
        'total_lost': total_lost,
        'total_found': total_found,
        'total_feedback': total_feedback,
        'total_events': total_events,
        'lost_status': lost_status,
        'sentiment_stats': sentiment_stats,
        'monthly_activity': monthly_activity
    }, 200