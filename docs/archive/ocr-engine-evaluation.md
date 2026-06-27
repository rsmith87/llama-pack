# OCR Engine Evaluation

This repo should keep the shared OCR service as the baseline. The current
service already supports Tesseract and the PP-OCRv5 detection/recognition pair
through `OcrEngineConfig`. The recently updated PaddleOCR-VL options are
promising document parsers, but they do not fit the current
`det_model`/`rec_model` contract and should not replace the default until a
local benchmark proves enough quality gain to justify a new runner.

## Smallest Realistic Candidates

| Candidate | Status in this repo | Exact repo config | Decision role |
| --- | --- | --- | --- |
| Tesseract | Runnable now | `{"engine": "tesseract"}` | Baseline and default |
| PP-OCRv5 server det/rec | Runnable after model install | `{"engine": "paddleocr", "det_model": "models/ocr/pp-ocrv5-server/det", "rec_model": "models/ocr/pp-ocrv5-server/rec", "det_model_name": "PP-OCRv5_server_det", "rec_model_name": "PP-OCRv5_server_rec"}` | First challenger because it uses the current shared service |
| PaddleOCR-VL 0.9B | Needs a new runner | `{"engine": "paddleocr-vl", "model_dir": "models/ocr/paddleocr-vl-0.9b", "model_name": "PaddleOCR-VL-0.9B"}` | Smallest VLM candidate |
| PaddleOCR-VL 1.5 | Needs a new runner | `{"engine": "paddleocr-vl", "model_dir": "models/ocr/paddleocr-vl-1.5", "model_name": "PaddleOCR-VL-1.5"}` | Updated robustness candidate |
| PaddleOCR-VL 1.6 | Needs a new runner | `{"engine": "paddleocr-vl", "model_dir": "models/ocr/paddleocr-vl-1.6", "model_name": "PaddleOCR-VL-1.6"}` | Preferred VLM challenger if adding a VLM path |

## Recommendation

Do not standardize on PaddleOCR-VL yet. Standardize operationally on the shared
OCR service with Tesseract as the default and PP-OCRv5 as the first local
challenger. Add a PaddleOCR-VL runner only if the evaluation harness shows that
PaddleOCR-VL 1.6 materially beats PP-OCRv5 on the repo's real document set.

The reason is practical: PaddleOCR-VL 0.9B, 1.5, and 1.6 are still 0.9B VLM
document parsers, while this repo's current OCR contract is line-oriented OCR
with optional PDF page rendering. Replacing the default now would combine a
model decision with an integration-contract change.

## Harness

Print the exact candidate config without loading OCR engines:

```bash
rtk uv run python scripts/evaluate_ocr_candidates.py --file samples/invoice.png --config-only
```

Run the shared-service candidates on one or more files:

```bash
rtk uv run python scripts/evaluate_ocr_candidates.py --file samples/invoice.png --candidate tesseract-baseline
rtk uv run python scripts/evaluate_ocr_candidates.py --file samples/invoice.png --candidate tesseract-baseline --candidate ppocrv5-server
```

Install the current PP-OCRv5 challenger models with:

```bash
rtk scripts/install_ocr_model.sh
```

The harness returns JSON with candidate metadata, elapsed seconds, extracted
character count, item count, and errors. Use a representative local document set
that includes scanned invoices, tables, photos of pages, low-contrast documents,
and multilingual samples before changing the default.

## Source Snapshot

As of 2026-06-24, the smallest PaddleOCR-VL line remains 0.9B. PaddleOCR-VL
1.5 was published on 2026-01-29 and reports 94.5% on OmniDocBench v1.5.
PaddleOCR-VL 1.6 was published on 2026-06-02 and reports 96.33% on
OmniDocBench v1.6. The original PaddleOCR-VL report describes the 0.9B model as
supporting 109 languages and handling text, tables, formulas, and charts.
