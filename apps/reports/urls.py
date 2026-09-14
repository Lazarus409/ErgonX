from rest_framework.routers import DefaultRouter
from apps.reports.views import ReportsViewSet

router = DefaultRouter()
router.register("reports", ReportsViewSet, basename="report")
urlpatterns = router.urls
