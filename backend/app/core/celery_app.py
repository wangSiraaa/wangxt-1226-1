from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "stability_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_routes={
        "app.tasks.sampling.*": {"queue": "reminder"},
        "app.tasks.monitoring.*": {"queue": "default"},
    },
    beat_schedule={
        "check-sampling-windows-every-hour": {
            "task": "app.tasks.sampling.check_sampling_windows",
            "schedule": 3600.0,
        },
        "check-environment-deviations-every-30-min": {
            "task": "app.tasks.monitoring.check_environment_deviations",
            "schedule": 1800.0,
        },
    },
)

celery_app.autodiscover_tasks(["app.tasks"])
