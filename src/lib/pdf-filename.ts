// Builds the filename used both for the "download PDF" link and for the
// PDF attached to outgoing invoice/quote emails, e.g. "Cera Technologies INV-0001.pdf".
// Strips characters that aren't safe in filenames (across Windows/macOS/Linux)
// so a business name with a slash, colon, etc. doesn't break the download.
export function buildPdfFilename(businessName: string, docNumber: string): string {
  const safeBusinessName = businessName.trim().replace(/[\\/:*?"<>|]/g, "");
  const safeDocNumber = docNumber.trim().replace(/[\\/:*?"<>|]/g, "");
  const name = [safeBusinessName, safeDocNumber].filter(Boolean).join(" ");
  return `${name || "document"}.pdf`;
}
