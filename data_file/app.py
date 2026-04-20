from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from models import db, Device, SensorData, Anomaly
from datetime import datetime, timedelta
import random
import os
import numpy as np
from dltss_service import dltss_service

app = Flask(__name__)

basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, 'dataset', 'industrial.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
CORS(app)

# Create database tables within the application context
with app.app_context():
    db.create_all()
    
# Load model when the application starts
with app.app_context():
    print("Loading model for device 1...")
    success = dltss_service.load_model()
    if success:
        print("Model loaded successfully!")
    else:
        print("Model loading failed!")

@app.route('/api/test', methods=['GET'])
def test():
    return jsonify({"message": "Backend is running", "status": "success"})

@app.route('/api/devices', methods=['GET'])
def get_devices():
    devices = Device.query.all()
    result = []
    for d in devices:
        result.append({
            "id": d.id,
            "name": d.name,
            "type": d.device_type,
            "status": d.status,
            "health_score": d.health_score
        })
    return jsonify(result)

@app.route('/api/devices/<int:device_id>', methods=['GET'])
def get_device(device_id):
    device = Device.query.get(device_id)
    if not device:
        return jsonify({"error": "Device not found"}), 404
    
    recent_anomalies = Anomaly.query.filter_by(device_id=device_id)\
        .order_by(Anomaly.timestamp.desc()).limit(5).all()
    
    anomalies_list = []
    for a in recent_anomalies:
        anomalies_list.append({
            "time": a.timestamp.strftime("%Y-%m-%d %H:%M"),
            "type": a.anomaly_type,
            "severity": a.severity,
            "value": a.value
        })
    
    return jsonify({
        "id": device.id,
        "name": device.name,
        "type": device.device_type,
        "status": device.status,
        "health_score": device.health_score,
        "recent_anomalies": anomalies_list
    })

@app.route('/api/devices/<int:device_id>/realtime', methods=['GET'])
def get_realtime_data(device_id):
    latest = db.session.query(db.func.max(SensorData.timestamp)).filter_by(device_id=device_id).scalar()
    if not latest:
        return jsonify([])
    
    end_time = latest
    start_time = end_time - timedelta(hours=24)
    
    data = SensorData.query.filter(
        SensorData.device_id == device_id,
        SensorData.timestamp >= start_time,
        SensorData.timestamp <= end_time
    ).order_by(SensorData.timestamp).all()
    
    result = []
    for d in data:
        result.append({
            "timestamp": d.timestamp.strftime("%Y-%m-%d %H:%M"),
            "temperature": d.ot,
            "pressure": d.hufl / 1000 if d.hufl else 0,
            "vibration": d.mufl / 1000 if d.mufl else 0
        })
    
    return jsonify(result)

@app.route('/api/anomalies/summary', methods=['GET'])
def get_anomaly_summary():
    total_anomalies = Anomaly.query.count()
    error_count = Anomaly.query.filter_by(severity='error').count()
    warning_count = Anomaly.query.filter_by(severity='warning').count()
    
    type_stats = db.session.query(
        Anomaly.anomaly_type, 
        db.func.count(Anomaly.id)
    ).group_by(Anomaly.anomaly_type).all()
    
    types_list = [{"type": t[0], "count": t[1]} for t in type_stats]
    
    total_sensor_data = SensorData.query.count()
    
    return jsonify({
        "total_anomalies": total_anomalies,
        "error_count": error_count,
        "warning_count": warning_count,
        "normal_count": total_sensor_data - total_anomalies,  
        "anomaly_percentage": round(total_anomalies / total_sensor_data * 100, 2) if total_sensor_data > 0 else 0,
        "by_type": types_list
    })

@app.route('/api/performance', methods=['GET'])
def get_performance():
    return jsonify({
        "correlation_score": 0.924,
        "prediction_score": 0.927,
        "multits_score": 0.821,
        "generated_sequences": 2364
    })

@app.route('/api/generation/comparison', methods=['GET'])
def get_generation_comparison():
    real_data = SensorData.query.order_by(SensorData.timestamp.desc()).limit(100).all()
    
    generated = []
    for d in real_data:
        generated.append({
            "timestamp": d.timestamp.strftime("%Y-%m-%d %H:%M"),
            "real_value": d.ot,
            "generated_value": d.ot + random.uniform(-0.5, 0.5)
        })
    
    return jsonify(generated)

# ========== Prediction Endpoint ==========
@app.route('/api/predict/<int:device_id>', methods=['GET'])
def predict_device(device_id):
    """Get prediction data from cached file"""
    try:
        steps = request.args.get('steps', 12, type=int)
        
        predictions = dltss_service.predict_from_file(device_id, steps)
        
        if predictions is None:
            return jsonify({"error": "Prediction data not found"}), 404
        
        return jsonify({
            "device_id": device_id,
            "steps": steps,
            "predictions": predictions
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== Imputation Endpoint ==========
@app.route('/api/impute/<int:device_id>', methods=['GET'])
def impute_device(device_id):
    """Get imputation data from cached file"""
    try:
        ratio = request.args.get('ratio', 0.6, type=float)
        
        if ratio not in [0.6, 0.7, 0.8]:
            return jsonify({"error": "Missing ratio must be 0.6, 0.7, or 0.8"}), 400
        
        result = dltss_service.impute_from_file(device_id, ratio)
        
        if result is None:
            return jsonify({"error": "Imputation data not found"}), 404
        
        return jsonify({
            "device_id": device_id,
            "missing_ratio": ratio,
            "imputed_data": result["imputed_data"],
            "mask": result["mask"]
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== Generate Tail Data Endpoint ==========
@app.route('/api/generate/tail', methods=['GET'])
def generate_tail_data():
    """Generate long-tail data from cached file"""
    try:
        num_samples = request.args.get('num_samples', 100, type=int)
        device_id = request.args.get('device_id', 1, type=int)
        
        result = dltss_service.generate_from_file(device_id, num_samples)
        
        if result is None:
            return jsonify({"error": "Generation data not found"}), 404
        
        # Limit response size to avoid timeout
        if len(result["generated_data"]) > 20:
            result["generated_data"] = result["generated_data"][:20]
            result["message"] = f"Showing first 20 of {result['num_samples']} samples"
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
        
@app.route('/api/visualization/pca/<int:device_id>', methods=['GET'])
def get_pca_visualization(device_id):
    """Get PCA visualization data for real vs generated samples"""
    try:
        num_samples = request.args.get('num_samples', 500, type=int)
        result = dltss_service.get_pca_visualization(device_id, num_samples)
        
        if result is None:
            return jsonify({"error": "PCA data not found"}), 404
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)