import io
import os
from typing import List, Dict, Any

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from paddleocr import PaddleOCR
from pdf2image import convert_from_bytes
from PIL import Image

app = FastAPI()

MAX_PAGES = int(os.getenv("OCR_MAX_PAGES", "5"))

ocr = PaddleOCR(use_angle_cls=True, lang="en")


def ocr_image(image: Image.Image) -> Dict[str, Any]:
    result = ocr.ocr(image, cls=True)
    lines = []
    confidences = []
    for page in result:
        for line in page:
            text = line[1][0]
            score = float(line[1][1])
            lines.append(text)
            confidences.append(score)

    text = "\n".join(lines).strip()
    confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return {
        "text": text,
        "confidence": confidence,
    }


@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")

    content = await file.read()
    filename = (file.filename or "").lower()
    mime = (file.content_type or "").lower()

    pages: List[Dict[str, Any]] = []
    combined_text_parts: List[str] = []
    confidence_sum = 0.0
    page_count = 0

    if mime == "application/pdf" or filename.endswith(".pdf"):
        images = convert_from_bytes(content, first_page=1, last_page=MAX_PAGES)
        for idx, image in enumerate(images, start=1):
            result = ocr_image(image)
            pages.append({
                "page_number": idx,
                "text": result["text"],
                "confidence": result["confidence"],
                "rotation_applied": 0,
                "quality_score": result["confidence"] * 100,
            })
            if result["text"]:
                combined_text_parts.append(result["text"])
            confidence_sum += result["confidence"]
            page_count += 1
    else:
        image = Image.open(io.BytesIO(content))
        result = ocr_image(image)
        pages.append({
            "page_number": 1,
            "text": result["text"],
            "confidence": result["confidence"],
            "rotation_applied": 0,
            "quality_score": result["confidence"] * 100,
        })
        if result["text"]:
            combined_text_parts.append(result["text"])
        confidence_sum += result["confidence"]
        page_count = 1

    combined_text = "\n\n".join(combined_text_parts).strip()
    avg_confidence = confidence_sum / page_count if page_count else 0.0

    return JSONResponse({
        "text": combined_text,
        "confidence": avg_confidence,
        "language": "eng",
        "page_count": page_count,
        "warnings": [],
        "pages": pages,
    })
