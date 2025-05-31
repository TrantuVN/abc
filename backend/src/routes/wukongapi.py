# backend/src/routes/wukong_api.py
from fastapi import APIRouter, UploadFile, File
from services.wukong import Wukong

router = APIRouter()

@router.post("/encode-dna")
async def encode_dna(file: UploadFile = File(...)):
    content = await file.read()
    wukong = Wukong(content)
    return {"res_dna_seq": wukong.res_dna_seq}
