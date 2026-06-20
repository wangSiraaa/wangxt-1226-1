from datetime import datetime, timedelta
from celery import shared_task
import logging

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.config import settings
from app.crud.crud_environment import find_unacknowledged_alerts, create_environment_record
from app.crud.crud_user import get_users_by_role
from app.crud.crud_notification import create_notifications
from app.models.notification import NotificationType
from app.models.user import RoleEnum
from app.models.protocol import ProtocolStorageCondition
from app.schemas.environment import EnvironmentRecordCreate
import random

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.monitoring.check_environment_deviations")
def check_environment_deviations() -> dict:
    """
    检查是否有未被确认的环境警报，如果存在时间超过阈值，升级警报级别并再次通知。
    """
    db = SessionLocal()
    try:
        unack = find_unacknowledged_alerts(db, minutes_threshold=30)
        
        qa_users = get_users_by_role(db, RoleEnum.QA)
        qa_ids = [u.id for u in qa_users]
        
        critical_unack = [a for a in unack if a.alert_level.value == "critical"]
        warning_unack = [a for a in unack if a.alert_level.value == "warning"]
        
        if unack and qa_ids:
            create_notifications(db, type('NC', (), {
                'user_ids': qa_ids,
                'notification_type': NotificationType.ENVIRONMENT_ALERT,
                'title': f'【升级警报】{len(unack)} 个环境警报未确认',
                'message': (
                    f'共有 {len(unack)} 个环境警报未被确认超过 30 分钟。'
                    f'其中严重 {len(critical_unack)} 个，警告 {len(warning_unack)} 个。'
                    f'请 QA 立即查看并处理！'
                ),
                'priority': 3,
            })())
        
        return {
            "unacknowledged_alerts": len(unack),
            "critical": len(critical_unack),
            "warning": len(warning_unack),
            "notified_qa_count": len(qa_ids),
            "run_at": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error in check_environment_deviations: {str(e)}", exc_info=True)
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(name="app.tasks.monitoring.simulate_environment_sensor")
def simulate_environment_sensor(chamber_id: str = "CHAMBER-001") -> dict:
    """
    模拟环境传感器数据采集（用于测试/演示）。
    每 10 分钟随机生成一条温湿度记录。
    """
    db = SessionLocal()
    try:
        cond = db.query(ProtocolStorageCondition).filter(
            ProtocolStorageCondition.chamber_id == chamber_id
        ).first()
        
        if cond:
            temp_target = cond.temperature_target
            temp_min = cond.temperature_min - settings.TEMP_TOLERANCE
            temp_max = cond.temperature_max + settings.TEMP_TOLERANCE
            hum_target = cond.humidity_target or 60
            hum_min = (cond.humidity_min or 55) - settings.HUMIDITY_TOLERANCE
            hum_max = (cond.humidity_max or 65) + settings.HUMIDITY_TOLERANCE
            cond_id = cond.id
        else:
            temp_target = settings.TEMP_NORMAL_TARGET if hasattr(settings, 'TEMP_NORMAL_TARGET') else 25
            temp_min = temp_target - settings.TEMP_TOLERANCE
            temp_max = temp_target + settings.TEMP_TOLERANCE
            hum_target = settings.HUMIDITY_NORMAL_TARGET if hasattr(settings, 'HUMIDITY_NORMAL_TARGET') else 60
            hum_min = hum_target - settings.HUMIDITY_TOLERANCE
            hum_max = hum_target + settings.HUMIDITY_TOLERANCE
            cond_id = None
        
        abnormal_prob = random.random()
        if abnormal_prob < 0.1:
            temp = round(random.uniform(temp_max + 0.5, temp_max + 4.0), 1)
        elif abnormal_prob < 0.15:
            temp = round(random.uniform(temp_min - 4.0, temp_min - 0.5), 1)
        else:
            temp = round(random.uniform(temp_target - 0.5, temp_target + 0.5), 1)
        
        humidity = round(random.uniform(
            max(hum_min, hum_target - 3),
            min(hum_max, hum_target + 3)
        ), 1)
        
        record_in = EnvironmentRecordCreate(
            chamber_id=chamber_id,
            condition_id=cond_id,
            temperature=temp,
            humidity=humidity,
            recorded_at=datetime.utcnow(),
        )
        record, alerts = create_environment_record(db, record_in, recorded_by=None)
        
        return {
            "chamber": chamber_id,
            "temperature": temp,
            "humidity": humidity,
            "record_id": record.id,
            "deviation": record.has_deviation,
            "alerts_generated": len(alerts),
            "run_at": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error in simulate_environment_sensor: {str(e)}", exc_info=True)
        return {"error": str(e)}
    finally:
        db.close()
