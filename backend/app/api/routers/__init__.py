from fastapi import APIRouter
from app.api.routers import auth, protocol, sample, environment, test_result, deviation, notification

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(protocol.router)
api_router.include_router(sample.router)
api_router.include_router(environment.router)
api_router.include_router(test_result.router)
api_router.include_router(deviation.router)
api_router.include_router(notification.router)
