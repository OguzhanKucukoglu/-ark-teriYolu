# AVATAR — Üretim, Maliyet, Satış ve Lot İzlenebilirlik Sistemi

## Teknoloji Stack

| Katman | Teknoloji |
|---|---|
| Android | Kotlin + SQLite |
| Backend | Node.js + Express + TypeScript |
| Frontend | Vite + React + TypeScript + Ant Design |
| Ana DB | MySQL 8.0 |
| ML Servisi | Python + FastAPI + scikit-learn |
| Senkronizasyon | Event-driven (offline queue) |

## Hızlı Başlangıç (Docker)

```bash
# Tüm servisleri başlat
docker-compose up --build

# Servisler:
# MySQL:    localhost:3306
# Backend:  localhost:3000
# Frontend: localhost:5173
# ML:       localhost:8000
```

## Yerel Geliştirme

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### ML Servisi
```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload
```

## API Uç Noktaları

| Endpoint | Yöntem | Açıklama |
|---|---|---|
| /api/auth/register | POST | Kullanıcı kaydı |
| /api/auth/login | POST | Giriş |
| /api/animals | POST | Hayvan girişi |
| /api/butchery | POST | Parçalama işlemi |
| /api/orders | POST | Sipariş oluştur |
| /api/production/:id/complete | PATCH | Üretim tamamla (EKP hesabı) |
| /api/lots/:id/trace/forward | GET | İleri lot izleme |
| /api/lots/:id/trace/backward | GET | Geri lot izleme |
| /api/recalls | POST | Geri çağırma başlat |
| /api/ml/predict/production | POST | Üretim verimi tahmini |
| /api/ml/predict/butchery | POST | Parçalama verimi tahmini |

## Demo Senaryosu

ET-2026-001 lot numaralı et → URT-2026-045 üretim emri → SUC-2026-045 sucuk lotu
→ Market A (30 paket), Market B (25 paket), Market C (30 paket)

Geri çağırma testi: `/api/recalls` POST ile lotId=4, reason="Kalite sorunu"
