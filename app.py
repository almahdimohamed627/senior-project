from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import uvicorn
import numpy as np
from PIL import Image
import io
import tensorflow as tf

# ------------------------------
# 1) تحميل المودل
# ------------------------------
MODEL_PATH = "model/dental_model.keras"
model = tf.keras.models.load_model(MODEL_PATH)

# اسماء الفئات
class_names = ["caries", "calculus", "hypodontia"]

# ------------------------------
# 2) إنشاء API
# ------------------------------
app = FastAPI(
    title="Dental Disease Detection API",
    description="API to classify dental images",
    version="1.0",
)

# ------------------------------
# 3) دالة تجهيز الصورة
# ------------------------------
def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

# ------------------------------
# 4) POST endpoint لتصنيف الصورة مع threshold
# ------------------------------
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        img = preprocess_image(image_bytes)

        # تنبؤ
        predictions = model.predict(img)
        predicted_class = class_names[np.argmax(predictions)]
        confidence = float(np.max(predictions))

        # Threshold لتحديد إذا لا يوجد مرض
        threshold = 0.3  # 30%
        if confidence < threshold:
            return JSONResponse({
                "prediction": "no_disease",
                "confidence": confidence,
                "status": "no_disease_detected"
            })

        return JSONResponse({
            "prediction": predicted_class,
            "confidence": confidence,
            "status": "disease_detected"
        })

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# ------------------------------
# 5) نقطة تشغيل محلية
# ------------------------------
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
