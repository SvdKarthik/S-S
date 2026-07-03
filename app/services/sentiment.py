import re

# Sentiment keyword lexicon
POSITIVE_KEYWORDS = [
    'good', 'great', 'clean', 'fresh', 'tasty', 'excellent', 'nice',
    'amazing', 'fast', 'love', 'healthy', 'better', 'improved', 'friendly',
    'delicious', 'wonderful', 'perfect', 'satisfied', 'happy', 'quality',
    'awesome', 'brilliant', 'fantastic', 'superb', 'outstanding', 'recommend'
]

NEGATIVE_KEYWORDS = [
    'bad', 'worst', 'dirty', 'late', 'cold', 'stale', 'slow', 'rude',
    'poor', 'awful', 'delay', 'unhygienic', 'issue', 'problem', 'crowded',
    'disgusting', 'terrible', 'horrible', 'disappointed', 'unacceptable',
    'horrible', 'pathetic', 'useless', 'waste', 'disgusting', 'complaint'
]

def analyze_sentiment(text):
    """Analyze sentiment of feedback text using keyword matching."""
    text_lower = text.lower()
    
    # Count positive and negative words
    positive_count = sum(1 for word in POSITIVE_KEYWORDS if word in text_lower)
    negative_count = sum(1 for word in NEGATIVE_KEYWORDS if word in text_lower)
    
    # Calculate sentiment score
    score = positive_count - negative_count
    
    # Determine sentiment category
    if score > 0:
        sentiment = 'positive'
    elif score < 0:
        sentiment = 'negative'
    else:
        sentiment = 'neutral'
    
    # Normalize score to range [-1, 1]
    max_score = max(positive_count, negative_count, 1)
    normalized_score = score / max_score if max_score > 0 else 0
    
    return {
        'sentiment': sentiment,
        'score': normalized_score,
        'positive_words': positive_count,
        'negative_words': negative_count
    }