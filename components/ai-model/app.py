from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import uvicorn

import numpy as np
from numpy.linalg import norm
from PIL import Image
import io
import tensorflow as tf

# ------------------------------
# Paths
# ------------------------------
MODEL_PATH = "model/dental_model.keras"
TOOTH_EMB_PATH = "model/tooth_ref_embeddings_gap.npy"
NON_TOOTH_EMB_PATH = "model/non_tooth_ref_embeddings_gap.npy"

# ------------------------------
# Load model
# ------------------------------
model = tf.keras.models.load_model(MODEL_PATH)

class_names = ["caries", "calculus", "hypodontia"]

# Feature model (embedding)
feature_model = tf.keras.Model(
    inputs=model.input,
    outputs=model.get_layer("global_average_pooling2d").output
)

# ------------------------------
# Load embeddings
# ------------------------------
tooth_refs = np.load(TOOTH_EMB_PATH)
non_tooth_refs = np.load(NON_TOOTH_EMB_PATH)

tooth_refs_n = tooth_refs / (np.linalg.norm(tooth_refs, axis=1, keepdims=True) + 1e-8)
non_tooth_refs_n = non_tooth_refs / (np.linalg.norm(non_tooth_refs, axis=1, keepdims=True) + 1e-8)

# ------------------------------
# App
# ------------------------------
app = FastAPI(title="Dental API", version="3.0")

# ------------------------------
# Helpers
# ------------------------------
def preprocess(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, 0)

def min_cosine_distance(emb, refs_n):
    emb_n = emb / (norm(emb) + 1e-8)
    sims = refs_n @ emb_n
    dists = 1.0 - sims
    return float(np.min(dists))

def is_tooth_image(x):
    emb = feature_model.predict(x, verbose=0)[0]
    d_tooth = min_cosine_distance(emb, tooth_refs_n)
    d_non = min_cosine_distance(emb, non_tooth_refs_n)
    return d_tooth < d_non

# ------------------------------
# Endpoint
# ------------------------------
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        x = preprocess(image_bytes)

        # 1️⃣ Tooth Gate
        if not is_tooth_image(x):
            return JSONResponse({
                "status": "reupload"
            })

        # 2️⃣ Disease prediction
        probs = model.predict(x, verbose=0)[0]
        idx = int(np.argmax(probs))
        confidence = float(probs[idx])

        # Optional no-disease threshold
        if confidence < 0.70:
            return JSONResponse({
                "status": "no_disease_detected",
                "prediction": "no_disease",
                "confidence": confidence
            })

        return JSONResponse({
            "status": "disease_detected",
            "prediction": class_names[idx],
            "confidence": confidence
        })

    except Exception:
        return JSONResponse(
            {"status": "error"},
            status_code=500
        )

# ------------------------------
# Run
# ------------------------------
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000)
