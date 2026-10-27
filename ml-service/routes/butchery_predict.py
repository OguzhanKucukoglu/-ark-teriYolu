"""
Model B: Parçalama Verimi Tahmini
- Yeterli geçmiş veri (≥5 parçalama, aynı hayvan türü) varsa: RandomForest
- Az veri varsa: kural tabanlı reçete oranları
Backend, aynı hayvan türüne ait geçmiş veriyi 'history' alanında gönderir.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import numpy as np

router = APIRouter()

MIN_SAMPLES_FOR_ML = 5  # ML modeli için minimum parçalama sayısı

# Hayvan türü → beklenen parça oranları (fallback reçete)
RECIPES: Dict[str, List[Dict]] = {
    "inek": [
        {"part": "Gerdan",      "ratio": 0.0700},
        {"part": "Antrikot",    "ratio": 0.0800},
        {"part": "Kaburga",     "ratio": 0.1200},
        {"part": "Kontrfile",   "ratio": 0.0900},
        {"part": "Bonfile",     "ratio": 0.0400},
        {"part": "Sokum",       "ratio": 0.1000},
        {"part": "Bağırsak",    "ratio": 0.0300},
        {"part": "Kol",         "ratio": 0.1600},
        {"part": "Fire",        "ratio": 0.1000, "is_waste": True},
    ],
    "koyun": [
        {"part": "Pirzola",     "ratio": 0.1800},
        {"part": "But",         "ratio": 0.2800},
        {"part": "Kol",         "ratio": 0.1600},
        {"part": "Kaburga",     "ratio": 0.1200},
        {"part": "Bağırsak",    "ratio": 0.0300},
        {"part": "Gerdan",      "ratio": 0.0700},
        {"part": "İncik",       "ratio": 0.0900},
        {"part": "Fire",        "ratio": 0.0700, "is_waste": True},
    ],
    "tavuk": [
        {"part": "Bütün Tavuk", "ratio": 0.8500},
        {"part": "Fire",        "ratio": 0.1500, "is_waste": True},
    ],
}

# Arayüzde girilen hayvan türü → reçete anahtarı eşlemesi
ANIMAL_KEY_MAP = {
    "inek": "inek", "dana": "inek",
    "koyun": "koyun", "kuzu": "koyun",
    "tavuk": "tavuk",
}


class ButcheryPredictRequest(BaseModel):
    animal_type: str      # 'inek', 'koyun', 'tavuk'
    entry_weight_kg: float
    purchase_cost: Optional[float] = 0.0
    history: Optional[List[Dict[str, Any]]] = []


class PartPrediction(BaseModel):
    part_name: str
    predicted_weight_kg: float
    expected_ratio: float
    allocated_cost: float
    unit_cost: float


class ButcheryPredictResponse(BaseModel):
    animal_type: str
    entry_weight_kg: float
    parts: List[PartPrediction]
    predicted_waste_kg: float
    total_predicted_kg: float
    sample_count: int
    method: str
    notes: str


def _recipe_predict(animal_key: str, entry_kg: float, purchase_cost: float) -> dict:
    """Reçete tabanlı tahmin (fallback)."""
    recipe = RECIPES.get(animal_key, RECIPES["koyun"])
    parts = []
    waste_kg = 0.0
    total_main_ratio = sum(p["ratio"] for p in recipe if not p.get("is_waste", False))

    for item in recipe:
        pred_w = round(entry_kg * item["ratio"], 3)
        if item.get("is_waste", False):
            waste_kg = pred_w
            continue
        ratio_in_main  = item["ratio"] / total_main_ratio if total_main_ratio > 0 else 0
        allocated_cost = round(purchase_cost * ratio_in_main, 4)
        unit_cost      = round(allocated_cost / pred_w, 4) if pred_w > 0 else 0.0
        parts.append({
            "part_name":           item["part"],
            "predicted_weight_kg": pred_w,
            "expected_ratio":      item["ratio"],
            "allocated_cost":      allocated_cost,
            "unit_cost":           unit_cost,
        })

    total_pred = sum(p["predicted_weight_kg"] for p in parts) + waste_kg
    return {"parts": parts, "waste_kg": round(waste_kg, 3), "total": round(total_pred, 3)}


def _ml_predict(
    history: List[Dict[str, Any]],
    animal_key: str,
    entry_kg: float,
    purchase_cost: float,
) -> Optional[dict]:
    """
    Geçmiş parçalama verisinden parça oranlarını öğren.
    Her parça için ayrı RandomForest/Linear modeli.
    """
    try:
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.linear_model import LinearRegression

        # history: butchery_operations JOIN butchery_parts satırları
        # Her operation için parça ağırlıklarını topla
        ops: Dict[int, Dict] = {}
        for row in history:
            oid = row.get("id")
            if oid not in ops:
                ops[oid] = {
                    "entry_kg": float(row.get("total_output_kg") or entry_kg),
                    "cost":     float(row.get("total_cost") or 0),
                    "parts":    {},
                }
            part = row.get("part_name")
            w    = float(row.get("actual_weight_kg") or 0)
            if part and w > 0:
                ops[oid]["parts"][part] = w

        valid_ops = [v for v in ops.values() if v["entry_kg"] > 0 and v["parts"]]
        n_ops = len(valid_ops)

        if n_ops < 2:
            return None

        # Her parça için oran modeli eğit
        recipe   = RECIPES.get(animal_key, RECIPES["koyun"])
        all_parts = [p["part"] for p in recipe if not p.get("is_waste", False)]
        results  = []
        total_main_ratio = sum(p["ratio"] for p in recipe if not p.get("is_waste", False))

        X = np.array([[op["entry_kg"]] for op in valid_ops])

        for part_name in all_parts:
            y = np.array([
                op["parts"].get(part_name, 0) / op["entry_kg"]
                for op in valid_ops
            ])

            if n_ops >= MIN_SAMPLES_FOR_ML:
                model = RandomForestRegressor(n_estimators=30, random_state=42)
            else:
                model = LinearRegression()

            model.fit(X, y)
            pred_ratio = float(model.predict([[entry_kg]])[0])
            pred_ratio = max(0.0, min(0.99, pred_ratio))
            pred_w     = round(entry_kg * pred_ratio, 3)

            # Maliyet dağıtımı (reçetedeki oranla)
            recipe_item  = next((r for r in recipe if r["part"] == part_name), None)
            recipe_ratio = recipe_item["ratio"] if recipe_item else (1 / len(all_parts))
            ratio_in_main  = recipe_ratio / total_main_ratio if total_main_ratio > 0 else 0
            allocated_cost = round(purchase_cost * ratio_in_main, 4)
            unit_cost      = round(allocated_cost / pred_w, 4) if pred_w > 0 else 0.0

            results.append({
                "part_name":           part_name,
                "predicted_weight_kg": pred_w,
                "expected_ratio":      round(pred_ratio, 4),
                "allocated_cost":      allocated_cost,
                "unit_cost":           unit_cost,
            })

        total_pred = sum(r["predicted_weight_kg"] for r in results)
        waste_kg   = max(0.0, round(entry_kg - total_pred, 3))

        return {
            "parts":    results,
            "waste_kg": waste_kg,
            "total":    round(total_pred + waste_kg, 3),
            "n_ops":    n_ops,
            "method":   "random_forest" if n_ops >= MIN_SAMPLES_FOR_ML else "linear",
        }
    except Exception:
        return None


@router.post("/butchery", response_model=ButcheryPredictResponse)
def predict_butchery(req: ButcheryPredictRequest):
    animal_key = ANIMAL_KEY_MAP.get(req.animal_type.lower(), req.animal_type.lower())
    history    = req.history or []

    # ML tahmin dene
    ml = _ml_predict(history, animal_key, req.entry_weight_kg, req.purchase_cost or 0.0)

    if ml:
        return ButcheryPredictResponse(
            animal_type=req.animal_type,
            entry_weight_kg=req.entry_weight_kg,
            parts=[PartPrediction(**p) for p in ml["parts"]],
            predicted_waste_kg=ml["waste_kg"],
            total_predicted_kg=ml["total"],
            sample_count=ml["n_ops"],
            method=ml["method"],
            notes=(
                f"{ml['n_ops']} geçmiş parçalama kaydına dayalı "
                f"{ml['method'].replace('_', ' ')} modeli. "
                "Gerçek ağırlıklar girildikten sonra sapma otomatik hesaplanır."
            ),
        )

    # Yeterli veri yok — reçete tabanlı
    recipe_result = _recipe_predict(animal_key, req.entry_weight_kg, req.purchase_cost or 0.0)
    n = len(set(row.get("id") for row in history if row.get("id")))
    return ButcheryPredictResponse(
        animal_type=req.animal_type,
        entry_weight_kg=req.entry_weight_kg,
        parts=[PartPrediction(**p) for p in recipe_result["parts"]],
        predicted_waste_kg=recipe_result["waste_kg"],
        total_predicted_kg=recipe_result["total"],
        sample_count=n,
        method="recipe_based",
        notes=(
            f"Bu tür için yeterli geçmiş veri yok ({n} kayıt, minimum {MIN_SAMPLES_FOR_ML} gerekli). "
            "Standart reçete oranları kullanılıyor. "
            "Daha fazla parçalama kaydedildikçe kişisel model devreye girer."
        ),
    )
