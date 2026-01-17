import os

# ==============================
# TensorFlow: silence logs + force CPU
# IMPORTANT: must be set BEFORE importing tensorflow
# ==============================
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"      # prevent CUDA/cuInit errors (force CPU)
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"       # hide INFO/WARNING
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"      # optional: remove oneDNN message

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse

import numpy as np
from numpy.linalg import norm
from PIL import Image
import io
import tensorflow as tf

# ------------------------------
# 1) Paths
# ------------------------------
MODEL_PATH = "model/dental_model.keras"
TOOTH_EMB_PATH = "model/tooth_ref_embeddings_gap.npy"
NON_TOOTH_EMB_PATH = "model/non_tooth_ref_embeddings_gap.npy"

# ------------------------------
# 2) Load model (NO optimizer state -> fixes Adam warning)
# ------------------------------
model = tf.keras.models.load_model(MODEL_PATH, compile=False)

# Embedding model (GAP output)
feature_model = tf.keras.Model(
    inputs=model.input,
    outputs=model.get_layer("global_average_pooling2d").output
)

class_names = ["caries", "calculus", "hypodontia"]

# ------------------------------
# 3) Load embeddings ONCE + normalize ONCE (faster + consistent)
# ------------------------------
tooth_refs = np.load(TOOTH_EMB_PATH).astype("float32", copy=False)
non_refs   = np.load(NON_TOOTH_EMB_PATH).astype("float32", copy=False)

# Safety checks (important if you changed non_tooth file)
if tooth_refs.ndim != 2 or non_refs.ndim != 2:
    raise ValueError(f"Embeddings must be 2D arrays. Got tooth={tooth_refs.ndim}D, non={non_refs.ndim}D")

if tooth_refs.shape[1] != non_refs.shape[1]:
    raise ValueError(
        f"Embedding feature mismatch: tooth={tooth_refs.shape} vs non_tooth={non_refs.shape}. "
        "They must have the same feature dimension (columns)."
    )

tooth_refs_n = tooth_refs / (np.linalg.norm(tooth_refs, axis=1, keepdims=True) + 1e-8)
non_refs_n   = non_refs   / (np.linalg.norm(non_refs,   axis=1, keepdims=True) + 1e-8)

# ------------------------------
# 4) Thresholds
# ------------------------------
TOOTH_THRESHOLD = 0.45
DISEASE_THRESHOLD = 0.30

app = FastAPI(title="Dental Disease Detection API", version="1.0")

# ------------------------------
# Helpers
# ------------------------------
def preprocess_image_bytes(image_bytes: bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)

def min_cosine_distance(emb, refs_n):
    emb_n = emb / (norm(emb) + 1e-8)
    sims = refs_n @ emb_n
    dists = 1.0 - sims
    return float(np.min(dists))

def is_tooth_image(x):
    emb = feature_model.predict(x, verbose=0)[0]  # (features,)
    d_tooth = min_cosine_distance(emb, tooth_refs_n)
    d_non   = min_cosine_distance(emb, non_refs_n)

    return (d_tooth <= TOOTH_THRESHOLD) and (d_tooth < d_non)

# ------------------------------
# Endpoint
# ------------------------------
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        x = preprocess_image_bytes(image_bytes)

        if not is_tooth_image(x):
            return JSONResponse({"status": "reupload"})

        preds = model.predict(x, verbose=0)[0]
        idx = int(np.argmax(preds))
        confidence = float(preds[idx])
        predicted_class = class_names[idx]

        if confidence < DISEASE_THRESHOLD:
            return JSONResponse({
                "status": "no_disease_detected",
                "prediction": "no_disease",
                "confidence": confidence
            })

        return JSONResponse({
            "status": "disease_detected",
            "prediction": predicted_class,
            "confidence": confidence
        })

    except Exception as e:
        return JSONResponse({"status": "error", "detail": str(e)}, status_code=500)
