"""
Model A: Üretim Verimi, Paket Sayısı (1 kg/paket) ve Fire Tahmini
- Yeterli geçmiş veri (≥5 tamamlanmış üretim) varsa: RandomForest
- Az veri varsa: kural tabanlı referans model
Backend, geçmiş veriyi 'history' alanında gönderir.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import numpy as np

router = APIRouter()

MIN_SAMPLES_FOR_ML = 5  # ML modeli için minimum kayıt sayısı
PACKAGE_WEIGHT = 1.00   # Standart paket ağırlığı (1.00 kg/paket)


class ProductionPredictRequest(BaseModel):
    product_name: str
    producer_id: Optional[int] = None
    service_price_per_unit: float          # €/paket veya €/kg
    # Hammadde miktarları (kg) — anahtar: malzeme adı, değer: miktar
    materials: Optional[Dict[str, float]] = None
    # Backend'in eklediği geçmiş veri
    history: Optional[List[Dict[str, Any]]] = []


class ProductionPredictResponse(BaseModel):
    predicted_packages: int      # Tahmini üretilecek tam paket sayısı (1 kg/paket)
    package_weight: float        # 1.00 kg/paket standartı
    total_input_kg: float        # Toplam hammadde girdisi (kg)
    predicted_fire_kg: float     # Tahmini dolum ve kuruma firesi (kg)
    predicted_fire_rate: float   # Tahmini fire oranı (%)
    predicted_qty_ratio: float   # Verim oranı (0-1)
    predicted_ekp: float         # Paket başına tahmini EKP (€/paket)
    confidence: float            # 0-1
    sample_count: int            # Kaç kayıtla eğitildi
    method: str                  # "random_forest" | "linear" | "rule_based"
    notes: str


def _total_input_kg(materials: Optional[Dict[str, float]]) -> float:
    """Hammadde toplamı (kg)."""
    if not materials:
        return 0.0
    return sum(v for v in materials.values() if v and v > 0)


def _rule_based(total_input_kg: float, service_price: float) -> dict:
    """Kural tabanlı referans: ortalama %85 verim (%15 fire)."""
    YIELD = 0.85
    AVG_RAW_COST_PER_KG = 12.50  # €/kg genel ortalama

    theoretical_kg = total_input_kg * YIELD
    predicted_packages = max(1, int(round(theoretical_kg / PACKAGE_WEIGHT))) if total_input_kg >= 0.8 else 0
    net_packaged_kg = predicted_packages * PACKAGE_WEIGHT
    fire_kg = max(0.0, round(total_input_kg - net_packaged_kg, 3))
    fire_rate = round((fire_kg / total_input_kg) * 100, 2) if total_input_kg > 0 else 0.0

    raw_cost = total_input_kg * AVG_RAW_COST_PER_KG
    service_cost = predicted_packages * service_price
    ekp = (raw_cost + service_cost) / predicted_packages if predicted_packages > 0 else 0.0

    return {
        "packages": predicted_packages,
        "ratio": YIELD,
        "fire_kg": fire_kg,
        "fire_rate": fire_rate,
        "ekp": round(ekp, 4),
    }


def _ml_predict(history: List[Dict[str, Any]], total_input_kg: float, service_price: float) -> Optional[dict]:
    """
    Geçmiş veride actual_qty / expected_qty oranını ve EKP'yi öğren.
    Yeterli veri varsa RandomForest, değilse LinearRegression kullanır.
    """
    try:
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.linear_model import LinearRegression
        from sklearn.preprocessing import StandardScaler

        # Geçerli kayıtları filtrele
        valid = [
            h for h in history
            if h.get("actual_qty") and h.get("expected_qty")
            and float(h["actual_qty"]) > 0 and float(h["expected_qty"]) > 0
        ]
        n = len(valid)
        if n < 2:
            return None

        # Özellik: [expected_qty, service_cost, total_raw_cost]
        X, y_ratio, y_ekp = [], [], []
        for h in valid:
            exp = float(h["expected_qty"])
            act = float(h["actual_qty"])
            svc = float(h.get("service_cost") or 0)
            raw = float(h.get("total_raw_cost") or 0)
            X.append([exp, svc, raw])
            y_ratio.append(act / exp)
            y_ekp.append(float(h.get("ekp") or 0))

        X = np.array(X)
        y_ratio = np.array(y_ratio)
        y_ekp   = np.array(y_ekp)

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Model seçimi
        if n >= MIN_SAMPLES_FOR_ML:
            model_ratio = RandomForestRegressor(n_estimators=50, random_state=42)
            model_ekp   = RandomForestRegressor(n_estimators=50, random_state=42)
            method = "random_forest"
        else:
            model_ratio = LinearRegression()
            model_ekp   = LinearRegression()
            method = "linear"

        model_ratio.fit(X_scaled, y_ratio)
        model_ekp.fit(X_scaled, y_ekp)

        # Tahmin için girdi
        est_qty    = total_input_kg * 0.85
        est_svc    = est_qty * service_price
        est_raw    = total_input_kg * 12.50
        x_new      = scaler.transform([[est_qty, est_svc, est_raw]])

        pred_ratio = float(model_ratio.predict(x_new)[0])
        pred_ekp   = float(model_ekp.predict(x_new)[0])

        pred_ratio = max(0.1, min(1.5, pred_ratio))
        theoretical_kg = total_input_kg * pred_ratio
        predicted_packages = max(1, int(round(theoretical_kg / PACKAGE_WEIGHT))) if total_input_kg >= 0.8 else 0
        net_packaged_kg = predicted_packages * PACKAGE_WEIGHT
        fire_kg = max(0.0, round(total_input_kg - net_packaged_kg, 3))
        fire_rate = round((fire_kg / total_input_kg) * 100, 2) if total_input_kg > 0 else 0.0

        # Güven: tahmin sapmasının std'ye oranı
        residuals  = np.abs(y_ratio - model_ratio.predict(X_scaled))
        confidence = max(0.0, min(1.0, 1.0 - float(np.mean(residuals))))

        return {
            "packages":   predicted_packages,
            "ratio":      round(pred_ratio, 4),
            "fire_kg":    fire_kg,
            "fire_rate":  fire_rate,
            "ekp":        round(max(0, pred_ekp), 4),
            "confidence": round(confidence, 3),
            "method":     method,
            "n":          n,
        }
    except Exception:
        return None


@router.post("/production", response_model=ProductionPredictResponse)
def predict_production(req: ProductionPredictRequest):
    history = req.history or []
    total_input = _total_input_kg(req.materials)

    # ML tahmin dene
    ml = _ml_predict(history, total_input, req.service_price_per_unit)

    if ml:
        return ProductionPredictResponse(
            predicted_packages=ml["packages"],
            package_weight=PACKAGE_WEIGHT,
            total_input_kg=round(total_input, 3),
            predicted_fire_kg=ml["fire_kg"],
            predicted_fire_rate=ml["fire_rate"],
            predicted_qty_ratio=ml["ratio"],
            predicted_ekp=ml["ekp"],
            confidence=ml["confidence"],
            sample_count=ml["n"],
            method=ml["method"],
            notes=(
                f"{ml['n']} tamamlanmış üretim kaydına dayalı {ml['method'].replace('_', ' ')} modeli. "
                f"Tahmini çıktı: {ml['packages']} Paket (1 kg) | Tahmini Fire: {ml['fire_kg']} kg (%{ml['fire_rate']})."
            ),
        )

    # Yeterli veri yok — kural tabanlı
    rule = _rule_based(total_input, req.service_price_per_unit)
    n = len(history)
    return ProductionPredictResponse(
        predicted_packages=rule["packages"],
        package_weight=PACKAGE_WEIGHT,
        total_input_kg=round(total_input, 3),
        predicted_fire_kg=rule["fire_kg"],
        predicted_fire_rate=rule["fire_rate"],
        predicted_qty_ratio=rule["ratio"],
        predicted_ekp=rule["ekp"],
        confidence=0.5,
        sample_count=n,
        method="rule_based",
        notes=(
            f"Henüz yeterli üretici kaydı yok ({n} kayıt, minimum {MIN_SAMPLES_FOR_ML} gerekli). "
            f"Sektör ortalaması baz alındı: {rule['packages']} Paket (1 kg) | Tahmini Fire: {rule['fire_kg']} kg (%{rule['fire_rate']})."
        ),
    )
