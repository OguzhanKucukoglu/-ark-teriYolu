from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import production_predict, butchery_predict

app = FastAPI(title="AVATAR ML Servisi", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(production_predict.router, prefix="/predict", tags=["Üretim Tahmini"])
app.include_router(butchery_predict.router,   prefix="/predict", tags=["Parçalama Tahmini"])

@app.get("/health")
def health():
    return {"status": "ok"}
