"""
Generator QR code untuk game "Guess the Cappy".

Menghasilkan acr001.png ... acr365.png lalu di-zip.
- QR yang SALAH  -> berisi link ke halaman zonk (gambar Cappy)
- QR yang BENAR (hari ke-195 = 14 Juli) -> berisi teks flag

Cara pakai:
    pip install "qrcode[pil]"
    python generate_qr.py --base-url https://USERNAME.github.io/NAMA-REPO

Opsi tambahan:
    --out   folder output (default: qr_output)
    --flag  teks flag (default: happy unniversary acradiaa)
    --day   nomor hari yang benar (default: 195 = 14 Juli, tahun non-kabisat)
"""
import argparse
import os
import zipfile

import qrcode
from qrcode.constants import ERROR_CORRECT_M

TOTAL = 365


def make_qr(content: str, path: str) -> None:
    # version dikunci supaya ukuran/kepadatan grid sama untuk semua QR,
    # jadi QR yang benar tidak bisa dibedakan dari tampilannya.
    qr = qrcode.QRCode(
        version=6,
        error_correction=ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(content)
    qr.make(fit=False)
    qr.make_image(fill_color="black", back_color="white").save(path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", required=True,
                    help="URL GitHub Pages, contoh https://user.github.io/guess-the-cappy")
    ap.add_argument("--out", default="qr_output")
    ap.add_argument("--flag", default="happy unniversary acradiaa")
    ap.add_argument("--day", type=int, default=195)
    args = ap.parse_args()

    base = args.base_url.rstrip("/")
    os.makedirs(args.out, exist_ok=True)

    files = []
    for n in range(1, TOTAL + 1):
        name = f"acr{n:03d}"
        path = os.path.join(args.out, f"{name}.png")
        if n == args.day:
            content = args.flag
        else:
            content = f"{base}/zonk.html?c={name}"
        make_qr(content, path)
        files.append(path)

    zip_path = f"{args.out}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files:
            z.write(f, os.path.basename(f))

    print(f"Selesai: {TOTAL} QR -> {zip_path}")
    print(f"QR benar: acr{args.day:03d}.png (isi: {args.flag!r})")


if __name__ == "__main__":
    main()
