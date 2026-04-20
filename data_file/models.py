from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Device(db.Model):
    __tablename__ = 'devices'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    device_type = db.Column(db.String(50), default='transformer')
    status = db.Column(db.String(20), default='normal')
    health_score = db.Column(db.Float, default=100.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SensorData(db.Model):
    __tablename__ = 'sensor_data'
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('devices.id'))
    timestamp = db.Column(db.DateTime)
    
    hufl = db.Column(db.Float)
    hull = db.Column(db.Float)
    mufl = db.Column(db.Float)
    mull = db.Column(db.Float)
    lufl = db.Column(db.Float)
    lull = db.Column(db.Float)
    ot = db.Column(db.Float)

class Anomaly(db.Model):
    __tablename__ = 'anomalies'
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('devices.id'))
    timestamp = db.Column(db.DateTime)
    anomaly_type = db.Column(db.String(50))
    severity = db.Column(db.String(20))
    value = db.Column(db.Float)
    threshold = db.Column(db.Float)