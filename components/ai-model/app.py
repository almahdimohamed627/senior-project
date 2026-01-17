from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import numpy as np
from PIL import Image
import io
import tensorflow as tf
from numpy.linalg import norm

# ------------------------------
# 1) Paths
# ------------------------------
MODEL_PATH = "model/dental_model.keras"
TOOTH_EMB_PATH = "model/tooth_ref_embeddings_gap.npy"
NON_TOOTH_EMB_PATH = "model/non_tooth_ref_embeddings_gap.npy"

# ------------------------------
# 2) Load model
# ------------------------------
model = tf.keras.models.load_model(MODEL_PATH)

# Embedding model (GAP output: 1280)
feature_model = tf.keras.Model(
    inputs=model.input,
    outputs=model.get_layer("global_average_pooling2d").output
)

class_names = ["caries", "calculus", "hypodontia"]

tooth_refs = np.load(TOOTH_EMB_PATH)
non_refs = np.load(NON_TOOTH_EMB_PATH)

# ------------------------------
# 3) Thresholds
# ------------------------------
TOOTH_THRESHOLD = 0.45       # لقرار "هل الصورة أسنان؟" (أنت بتعدله لاحقاً)
DISEASE_THRESHOLD = 0.30     # لقرار "هل في مرض؟" (أنت قلت لاحقاً منختار الرقم)

app = FastAPI(title="Dental Disease Detection API", version="1.0")

def preprocess_image_bytes(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)

def min_cosine_distance(emb, refs):
    emb = emb / (norm(emb) + 1e-8)
    refs_n = refs / (np.linalg.norm(refs, axis=1, keepdims=True) + 1e-8)
    sims = refs_n @ emb
    dists = 1 - sims
    return float(np.min(dists))

def is_tooth_image(x):
    emb = feature_model.predict(x, verbose=0)[0]  # (1280,)
    d_tooth = min_cosine_distance(emb, tooth_refs)
    d_non = min_cosine_distance(emb, non_refs)

    # أسنان إذا:
    # 1) قريبة من أسنان (d_tooth <= threshold)
    # 2) وأقرب للأسنان من non-tooth (d_tooth < d_non)
    return (d_tooth <= TOOTH_THRESHOLD) and (d_tooth < d_non)

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        x = preprocess_image_bytes(image_bytes)

        # (A) إذا الصورة ليست أسنان/غير واضحة -> نفس خرجك اللي تريده
        if not is_tooth_image(x):
            return JSONResponse({"status": "reupload"})

        # تنبؤ المرض
        preds = model.predict(x, verbose=0)[0]
        idx = int(np.argmax(preds))
        confidence = float(np.max(preds))
        predicted_class = class_names[idx]

        # (B) أسنان لكن ما في مرض (حسب threshold)
        if confidence < DISEASE_THRESHOLD:
            return JSONResponse({
                "status": "no_disease_detected",
                "prediction": "no_disease",
                "confidence": confidence
            })

        # (C) أسنان وفي مرض
        return JSONResponse({
            "status": "disease_detected",
            "prediction": predicted_class,
            "confidence": confidence
        })

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
