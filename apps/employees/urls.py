from rest_framework.routers import DefaultRouter

from apps.employees.views import EmployeeViewSet, EmploymentViewSet

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("employments", EmploymentViewSet, basename="employment")

urlpatterns = router.urls
