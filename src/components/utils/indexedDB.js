import { openDB } from "idb";

async function getDB() {
  return openDB("pdfDatabase", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("pdfs")) {
        db.createObjectStore("pdfs");
      }
    },
  });
}

export async function savePdfToIndexedDB(id, pdfBlob) {
  const db = await getDB();
  await db.put("pdfs", pdfBlob, `pdf_${id}`);
  console.log("PDF guardado en IndexedDB");
}

// Carga un PDF
export async function loadPdfFromIndexedDB(id) {
  const db = await getDB();
  return db.get("pdfs", `pdf_${id}`);
}

// Elimina un PDF
export async function deletePdfFromIndexedDB(id) {
  const db = await getDB();
  await db.delete("pdfs", `pdf_${id}`);
}
