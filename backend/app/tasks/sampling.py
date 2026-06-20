from datetime import datetime, timedelta, date
from typing import List
from celery import shared_task
import logging

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.config import settings
from app.crud.crud_protocol import get_upcoming_sampling_windows, list_timepoints_by_protocol, get_sampling_window_info
from app.crud.crud_user import get_users_by_role
from app.crud.crud_notification import create_notifications
from app.models.notification import NotificationType
from app.models.protocol import ProtocolStatus, SamplingTimepoint, StabilityProtocol
from app.models.user import RoleEnum

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.sampling.check_sampling_windows")
def check_sampling_windows() -> dict:
    """
    每小时检查一次即将到来的取样窗口，生成提醒通知。
    """
    db = SessionLocal()
    try:
        hours_before = settings.SAMPLING_REMINDER_HOURS_BEFORE
        windows = get_upcoming_sampling_windows(db, hours_ahead=hours_before)
        
        urgent_windows = [w for w in windows if w.get("is_urgent") or w.get("days_until_window_start", 999) <= 1]
        normal_windows = [w for w in windows if w not in urgent_windows]
        
        warehouse_users = get_users_by_role(db, RoleEnum.WAREHOUSE)
        researcher_users = get_users_by_role(db, RoleEnum.RESEARCHER)
        all_targets = list(set([u.id for u in warehouse_users + researcher_users]))
        
        sent_count = 0
        
        for w in urgent_windows:
            if all_targets:
                label = w.get("timepoint_label", "")
                planned = w.get("planned_date", "")
                start = w.get("window_start", "")
                end = w.get("window_end", "")
                timepoint_id = w.get("timepoint_id")
                
                tp = db.query(SamplingTimepoint).filter(SamplingTimepoint.id == timepoint_id).first()
                protocol_code = "未知"
                if tp and tp.protocol:
                    protocol_code = tp.protocol.protocol_code
                
                create_notifications(db, type('NC', (), {
                    'user_ids': all_targets,
                    'notification_type': NotificationType.SAMPLING_REMINDER,
                    'title': f'【紧急】取样窗口即将开放 - {label}',
                    'message': (
                        f'方案 {protocol_code} 的取样点 {label} '
                        f'计划日期 {planned}。'
                        f'取样窗口: {start} ~ {end}。'
                        f'请仓库人员提前准备，确保在窗口内完成取样！'
                    ),
                    'related_type': 'timepoint',
                    'related_id': timepoint_id,
                    'priority': 3,
                })())
                sent_count += 1
        
        for w in normal_windows:
            if all_targets and w.get("days_until_window_start", 999) <= 3:
                label = w.get("timepoint_label", "")
                planned = w.get("planned_date", "")
                start = w.get("window_start", "")
                end = w.get("window_end", "")
                timepoint_id = w.get("timepoint_id")
                
                tp = db.query(SamplingTimepoint).filter(SamplingTimepoint.id == timepoint_id).first()
                protocol_code = "未知"
                if tp and tp.protocol:
                    protocol_code = tp.protocol.protocol_code
                
                create_notifications(db, type('NC', (), {
                    'user_ids': all_targets,
                    'notification_type': NotificationType.SAMPLING_REMINDER,
                    'title': f'取样提醒 - {label}',
                    'message': (
                        f'方案 {protocol_code} 的取样点 {label} '
                        f'还有 {w.get("days_until_window_start")} 天开放。'
                        f'计划日期: {planned}。窗口: {start} ~ {end}。'
                    ),
                    'related_type': 'timepoint',
                    'related_id': timepoint_id,
                    'priority': 1,
                })())
                sent_count += 1
        
        result = {
            "total_windows_found": len(windows),
            "urgent_windows": len(urgent_windows),
            "normal_windows_sent": len(normal_windows) - len([w for w in normal_windows if w.get("days_until_window_start", 999) > 3]),
            "notifications_sent": sent_count,
            "target_user_count": len(all_targets),
            "run_at": datetime.utcnow().isoformat(),
        }
        logger.info(f"Check sampling windows completed: {result}")
        return result
    except Exception as e:
        logger.error(f"Error in check_sampling_windows: {str(e)}", exc_info=True)
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(name="app.tasks.sampling.send_overdue_sampling_alert")
def send_overdue_sampling_alert() -> dict:
    """
    检查超过窗口但未完成的取样点，发送逾期警报。
    """
    db = SessionLocal()
    try:
        today = date.today()
        
        overdue_query = db.query(SamplingTimepoint).join(StabilityProtocol).filter(
            StabilityProtocol.status.in_([ProtocolStatus.APPROVED, ProtocolStatus.IN_PROGRESS]),
        ).all()
        
        overdue = []
        for tp in overdue_query:
            info = get_sampling_window_info(tp)
            if info["window_end"] < today and not info["can_sample_now"]:
                condition_count = len(tp.protocol.storage_conditions) if tp.protocol else 1
                expected = (tp.sample_count_per_condition or 1) * condition_count
                if tp.is_sampled < expected:
                    overdue.append({
                        "timepoint_id": tp.id,
                        "label": tp.timepoint_label,
                        "planned": tp.planned_date.isoformat(),
                        "window_end": info["window_end"].isoformat(),
                        "sampled": tp.is_sampled,
                        "expected": expected,
                        "protocol_code": tp.protocol.protocol_code if tp.protocol else "N/A",
                    })
        
        qa_users = get_users_by_role(db, RoleEnum.QA)
        warehouse_users = get_users_by_role(db, RoleEnum.WAREHOUSE)
        targets = list(set([u.id for u in qa_users + warehouse_users]))
        
        if overdue and targets:
            create_notifications(db, type('NC', (), {
                'user_ids': targets,
                'notification_type': NotificationType.DEVIATION_REPORTED,
                'title': f'【逾期警报】{len(overdue)} 个取样点未完成',
                'message': (
                    f'以下取样点已超过取样窗口但尚未完成取样：\n'
                    + '\n'.join([
                        f'- {o["protocol_code"]} / {o["label"]}: '
                        f'窗口截止 {o["window_end"]}, '
                        f'进度 {o["sampled"]}/{o["expected"]}'
                        for o in overdue[:10]
                    ])
                    + (f'\n... 还有 {len(overdue) - 10} 个未显示' if len(overdue) > 10 else '')
                    + '\n请立即处理，评估是否需要启动偏差调查。'
                ),
                'priority': 3,
            })())
        
        return {
            "overdue_count": len(overdue),
            "overdue_items": overdue,
            "notified_users": len(targets),
        }
    except Exception as e:
        logger.error(f"Error in send_overdue_sampling_alert: {str(e)}", exc_info=True)
        return {"error": str(e)}
    finally:
        db.close()
