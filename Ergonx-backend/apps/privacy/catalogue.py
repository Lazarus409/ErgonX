"""The organisation's data inventory, built from common.classification.DATA_CATALOGUE."""

from django.apps import apps
from django.db.models import Count

from apps.documents.models import Document
from apps.institutions.services import PERMISSIONS
from common.classification import DATA_CATALOGUE, LABEL, LEVELS, catalogue_models


def _count(model_name, institution, cache):
    if model_name not in cache:
        model = apps.get_model(model_name)
        names = {field.name for field in model._meta.get_fields()}
        if "institution" in names:
            cache[model_name] = model.objects.filter(institution=institution).count()
        elif model_name == "accounts.User":
            cache[model_name] = institution.memberships.values("user").distinct().count()
        elif "user" in names:
            cache[model_name] = model.objects.filter(user__memberships__institution=institution).distinct().count()
        else:
            cache[model_name] = None
    return cache[model_name]


def data_catalogue(institution):
    cache = {}
    enabled = set(institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))
    categories = []
    for category in DATA_CATALOGUE:
        models = catalogue_models(category)
        counts = [_count(name, institution, cache) for name in models]
        categories.append({
            "key": category.key,
            "label": category.label,
            "module": category.module,
            "module_enabled": category.module in ("CORE_HR", "PLATFORM") or category.module in enabled,
            "level": category.level,
            "level_label": LABEL[category.level],
            "kind": category.kind,
            "fields": [field.rsplit(".", 1)[-1].replace("_", " ") for field in category.fields],
            "access": [{"code": code, "name": PERMISSIONS.get(code, code)} for code in category.access],
            "records": max((count for count in counts if count is not None), default=None),
            "note": category.note,
        })
    documents = dict(
        Document.objects.for_institution(institution).filter(is_active=True)
        .order_by().values_list("classification").annotate(total=Count("pk")).values_list("classification", "total")
    )
    return {
        "levels": list(LEVELS),
        "categories": categories,
        "documents": [{"level": level["code"], "level_label": level["label"], "count": documents.get(level["code"], 0)} for level in LEVELS if level["code"] != "PUBLIC"],
    }
