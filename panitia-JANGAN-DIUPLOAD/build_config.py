"""
Menghasilkan config.js untuk game "Guess the Cappy".

Edit bagian PENGATURAN di bawah, lalu jalankan:
    python build_config.py

Jawaban TIDAK disimpan sebagai teks biasa. Yang masuk ke config.js hanya hash
SHA-256 (jawaban) dan data tim yang dienkripsi dengan kode tim, jadi
view-source tidak langsung membocorkan apa pun.
"""
import base64
import hashlib
import json
import re

# ===================== PENGATURAN =====================
SALT = "cappy-acr-2026"
PHRASE = "kapan ulang tahun acradia"        # hasil gabungan semua tim
FLAG = "happy unniversary acradiaa"          # isi QR yang benar (acr195)
ZIP_FILE = "assets/barcode.zip"              # lokasi zip di repo
SHOW_TOOL = True                             # tampilkan alat bantu geser caesar?
SHOW_SHIFT = False                           # beri tahu nilai geser di petunjuk?

# Satu kata per tim, dengan geser (shift) berbeda. Urutannya sengaja diacak
# supaya tim harus berdiskusi untuk menyusun kalimat.
TEAMS = [
    dict(code="CAPPY-A47", name="Tim 1", word="tahun",   shift=3),
    dict(code="CAPPY-B82", name="Tim 2", word="kapan",   shift=7),
    dict(code="CAPPY-C19", name="Tim 3", word="acradia", shift=11),
    dict(code="CAPPY-D55", name="Tim 4", word="ulang",   shift=5),
]
# ======================================================


def norm_text(s: str) -> str:
    s = re.sub(r"[^a-z0-9\s]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def norm_code(s: str) -> str:
    return re.sub(r"\s+", "", s.upper())


def H(s: str) -> str:
    return hashlib.sha256(f"{SALT}|{s}".encode()).hexdigest()


def caesar(text: str, shift: int) -> str:
    out = []
    for ch in text:
        if ch.isalpha() and ch.isascii():
            base = 65 if ch.isupper() else 97
            out.append(chr((ord(ch) - base + shift) % 26 + base))
        else:
            out.append(ch)
    return "".join(out)


def encrypt(obj: dict, code: str) -> str:
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    key = code.encode("utf-8")
    return base64.b64encode(bytes(b ^ key[i % len(key)] for i, b in enumerate(data))).decode()


def main() -> None:
    assert sorted(t["word"] for t in TEAMS) == sorted(PHRASE.split()), \
        "Kata-kata semua tim harus sama dengan isi PHRASE"

    teams = {}
    for t in TEAMS:
        code = norm_code(t["code"])
        hint = "Ini baru satu potongan kalimat. Cari potongan dari tim lain, lalu susun urutannya!"
        if SHOW_SHIFT:
            hint += f" (Kunci geser: {t['shift']})"
        payload = dict(name=t["name"], ct=caesar(t["word"], t["shift"]), hint=hint)
        teams[H("TEAM|" + code)] = encrypt(payload, code)

    config = dict(
        salt=SALT,
        teams=teams,
        phraseHash=H("PHRASE|" + norm_text(PHRASE)),
        flagHash=H("FLAG|" + norm_text(FLAG)),
        zipFile=ZIP_FILE,
        showTool=SHOW_TOOL,
    )
    with open("../guess-the-cappy/config.js", "w", encoding="utf-8") as f:
        f.write("// File ini dibuat otomatis oleh build_config.py. Jangan diedit manual.\n")
        f.write("const CONFIG = " + json.dumps(config, indent=2) + ";\n")

    print("config.js dibuat. Kode tim & teka-teki:")
    for t in TEAMS:
        print(f"  {t['name']}: kode={t['code']}  cipher={caesar(t['word'], t['shift'])}  (jawaban: {t['word']}, geser {t['shift']})")


if __name__ == "__main__":
    main()
