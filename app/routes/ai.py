from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, limiter
from app.models import AIConversation
from app.services.ai_service import get_ai_response

bp = Blueprint('ai', __name__)

@bp.route('/ask', methods=['POST'])
@jwt_required()
@limiter.limit('30 per hour')
def ask_ai():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if 'question' not in data or not data['question'].strip():
        return {'error': 'Question is required'}, 400
    
    try:
        response = get_ai_response(data['question'])
        
        conversation = AIConversation(
            user_id=user_id,
            question=data['question'],
            answer=response['answer'],
            model=response['model']
        )
        
        db.session.add(conversation)
        db.session.commit()
        
        return {
            'answer': response['answer'],
            'model': response['model'],
            'conversation_id': conversation.id
        }, 200
        
    except Exception as e:
        return {'error': str(e)}, 500

@bp.route('/history', methods=['GET'])
@jwt_required()
def get_history():
    user_id = get_jwt_identity()
    limit = request.args.get('limit', 50, type=int)
    
    conversations = AIConversation.query.filter_by(user_id=user_id)\
        .order_by(AIConversation.created_at.desc())\
        .limit(limit)\
        .all()
    
    return {'history': [conv.to_dict() for conv in conversations]}, 200

@bp.route('/history/<int:conv_id>', methods=['DELETE'])
@jwt_required()
def delete_history(conv_id):
    user_id = get_jwt_identity()
    
    conv = AIConversation.query.get(conv_id)
    if not conv:
        return {'error': 'Conversation not found'}, 404
    
    if conv.user_id != user_id:
        return {'error': 'Permission denied'}, 403
    
    db.session.delete(conv)
    db.session.commit()
    return {'message': 'Deleted'}, 200