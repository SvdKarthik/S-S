import os
try:
    import cloudinary
    import cloudinary.uploader
    CLOUDINARY_AVAILABLE = True
except ImportError:
    CLOUDINARY_AVAILABLE = False

def upload_image(file):
    """Upload image to Cloudinary and return URL."""
    if not file:
        return None
    if not CLOUDINARY_AVAILABLE:
        # For local development, just return a placeholder or None
        return None
    try:
        result = cloudinary.uploader.upload(file)
        return result.get('secure_url')
    except Exception as e:
        print(f'Upload error: {e}')
        return None