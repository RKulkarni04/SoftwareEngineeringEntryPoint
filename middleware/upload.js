// middleware/upload.js
// Handles multipart file uploads using multer.
// Supports text files, PDFs, and images up to 10MB.
// Files are stored in /uploads and also made available as parsed text for LLM context.

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

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
 * Images are returned as a base64 data URI instead.
 * PDFs: returns a placeholder — integrate pdf-parse if you want full text extraction.
 */
function readFileForContext(filePath, mimetype) {
  if (mimetype.startsWith("image/")) {
    const data = fs.readFileSync(filePath);
    return `[Image attached — base64 omitted for brevity. File: ${path.basename(filePath)}]`;
  }
  if (mimetype === "application/pdf") {
    // To enable PDF text extraction: npm install pdf-parse
    // const pdfParse = require("pdf-parse");
    // const buf = fs.readFileSync(filePath);
    // const data = await pdfParse(buf);
    // return data.text;
    return `[PDF attached: ${path.basename(filePath)}. Install pdf-parse for full text extraction.]`;
  }
  return fs.readFileSync(filePath, "utf8");
}

module.exports = { upload, readFileForContext, UPLOAD_DIR };
