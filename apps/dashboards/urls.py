from rest_framework.routers import DefaultRouter

from apps.dashboards.views import DashboardViewSet

router = DefaultRouter()
router.register("dashboards", DashboardViewSet, basename="dashboard")
urlpatterns = router.urls
