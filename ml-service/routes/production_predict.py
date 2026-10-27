"""
Model A: Üretim Verimi ve EKP Tahmini
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


class ProductionPredictRequest(BaseModel):
    product_name: str
    producer_id: Optional[int] = None
    service_price_per_unit: float          # €/kg
    # Hammadde miktarları (kg) — anahtar: malzeme adı, değer: miktar
    materials: Optional[Dict[str, float]] = None
    # Backend'in eklediği geçmiş veri
    history: Optional[List[Dict[str, Any]]] = []


class ProductionPredictResponse(BaseModel):
    predicted_qty_ratio: float   # verim oranı (0-1)
    predicted_ekp: float         # €/kg
    confidence: float            # 0-1
    sample_count: int            # kaç kayıtla eğitildi
    method: str                  # "random_forest" | "linear" | "rule_based"
    notes: str


def _total_input_kg(materials: Optional[Dict[str, float]]) -> float:
    """Hammadde toplamı (kg)."""
    if not materials:
        return 0.0
    return sum(v for v in materials.values() if v and v > 0)


def _rule_based(total_input_kg: float, service_price: float) -> dict:
    """Kural tabanlı referans: ortalama %85 verim."""
    YIELD = 0.85
    AVG_RAW_COST_PER_KG = 12.50  # €/kg genel ortalama
    predicted_qty = total_input_kg * YIELD
    raw_cost = total_input_kg * AVG_RAW_COST_PER_KG
    service_cost = predicted_qty * service_price
    ekp = (raw_cost + service_cost) / predicted_qty if predicted_qty > 0 else 0
    return {
        "ratio": YIELD,
        "ekp":   round(ekp, 4),
        "qty":   round(predicted_qty, 3),
    }


def _ml_predict(history: List[Dict[str, Any]], total_input_kg: float, service_price: float) -> dict:
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

        # Tahmin için girdi: beklenen çıktı ≈ input * 0.85 (ilk tahmin)
        est_qty    = total_input_kg * 0.85
        est_svc    = est_qty * service_price
        est_raw    = total_input_kg * 12.50
        x_new      = scaler.transform([[est_qty, est_svc, est_raw]])

        pred_ratio = float(model_ratio.predict(x_new)[0])
        pred_ekp   = float(model_ekp.predict(x_new)[0])

        # Güven: tahmin sapmasının std'ye oranı
        residuals  = np.abs(y_ratio - model_ratio.predict(X_scaled))
        confidence = max(0.0, min(1.0, 1.0 - float(np.mean(residuals))))

        return {
            "ratio":      round(max(0.1, min(1.5, pred_ratio)), 4),
            "ekp":        round(max(0, pred_ekp), 4),
            "confidence": round(confidence, 3),
            "method":     method,
            "n":          n,
        }
    except Exception as e:
        return None


@router.post("/production", response_model=ProductionPredictResponse)
def predict_production(req: ProductionPredictRequest):
    history = req.history or []
    total_input = _total_input_kg(req.materials)

    # ML tahmin dene
    ml = _ml_predict(history, total_input, req.service_price_per_unit)

    if ml:
        return ProductionPredictResponse(
            predicted_qty_ratio=ml["ratio"],
            predicted_ekp=ml["ekp"],
            confidence=ml["confidence"],
            sample_count=ml["n"],
            method=ml["method"],
            notes=(
                f"{ml['n']} tamamlanmış üretim kaydına dayalı {ml['method'].replace('_', ' ')} modeli. "
                f"Tahmini verim oranı: %{ml['ratio']*100:.1f}. "
                "Daha fazla üretim tamamlandıkça tahmin iyileşir."
            ),
        )

    # Yeterli veri yok — kural tabanlı
    rule = _rule_based(total_input, req.service_price_per_unit)
    n = len(history)
    return ProductionPredictResponse(
        predicted_qty_ratio=rule["ratio"],
        predicted_ekp=rule["ekp"],
        confidence=0.5,
        sample_count=n,
        method="rule_based",
        notes=(
            f"Henüz yeterli tamamlanmış üretim kaydı yok ({n} kayıt, minimum {MIN_SAMPLES_FOR_ML} gerekli). "
            "Genel sektör ortalaması kullanılıyor (%85 verim). "
            "Daha fazla üretim tamamlandıkça kişisel model devreye girer."
        ),
    )
