// middleware/upload.js
// Handles multipart file uploads using multer.
// Supports text files, PDFs, and images up to 10MB.
// Files are stored in /uploads and also made available as parsed text for LLM context.

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { PDFParse } = require("pdf-parse");

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** Cap injected PDF text so very large files do not blow context limits. */
const MAX_PDF_CONTEXT_CHARS = 120_000;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/pdf",
  "application/json",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type: ${file.mimetype}. Allowed: text, PDF, JSON, images.`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

/**
 * Read an uploaded file's content as a UTF-8 string for LLM context.
 * Images: short placeholder (no vision pipeline here).
 * PDFs: text layer via pdf-parse (v2 PDFParse API); scanned/image-only PDFs often yield no text.
 */
async function readFileForContext(filePath, mimetype) {
  if (mimetype.startsWith("image/")) {
    return `[Image attached — base64 omitted for brevity. File: ${path.basename(filePath)}]`;
  }
  if (mimetype === "application/pdf") {
    const base = path.basename(filePath);
    let parser;
    try {
      const buf = fs.readFileSync(filePath);
      parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      let text = String(result.text || "").replace(/\u0000/g, "").trim();
      if (!text) {
        return `[PDF: no extractable text in "${base}" — it may be scanned, image-only, or encrypted.]`;
      }
      if (text.length > MAX_PDF_CONTEXT_CHARS) {
        text =
          text.slice(0, MAX_PDF_CONTEXT_CHARS) +
          `\n\n[...truncated after ${MAX_PDF_CONTEXT_CHARS} characters]`;
      }
      return text;
    } catch (e) {
      const msg = e && e.message ? String(e.message) : "parse error";
      return `[PDF: could not read "${base}" (${msg}).]`;
    } finally {
      if (parser && typeof parser.destroy === "function") {
        try {
          await parser.destroy();
        } catch (_) {
          /* ignore */
        }
      }
    }
  }
  return fs.readFileSync(filePath, "utf8");
}

module.exports = { upload, readFileForContext, UPLOAD_DIR };
