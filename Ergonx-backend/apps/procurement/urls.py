from rest_framework.routers import DefaultRouter

from apps.procurement.views import GoodsReceiptViewSet, PurchaseOrderViewSet, PurchaseRequisitionViewSet

router = DefaultRouter()
router.register("procurement/requisitions", PurchaseRequisitionViewSet, basename="procurement-requisition")
router.register("procurement/orders", PurchaseOrderViewSet, basename="procurement-order")
router.register("procurement/receipts", GoodsReceiptViewSet, basename="procurement-receipt")

urlpatterns = router.urls
