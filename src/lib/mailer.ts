import nodemailer from "nodemailer";
import { buildPdfFilename } from "@/lib/pdf-filename";

// Resend's sandbox-mode 403 has a long technical body; surface the
// essential part in plain language instead of the raw API error text.
// Shared by the invoice/quote send actions so a failed send shows a
// useful message instead of crashing to the generic error page (thrown
// Server Action error messages get stripped by Next.js in production).
export function friendlyEmailError(raw: string): string {
  if (raw.includes("verify a domain")) {
    return "Emails can currently only be sent to your own account email while email sending is in test mode. Ask your Nimblo admin to verify a sending domain to email real clients.";
  }
  return "Couldn't send the email. Please try again, or let us know if this keeps happening.";
}

// Railway (like several PaaS hosts) blocks outbound SMTP traffic entirely
// as an anti-spam measure — both port 465 and 587 to smtp.resend.com timed
// out identically in testing, which is the signature of a blocked port
// rather than a config mistake. Resend's plain HTTPS API isn't affected by
// that (it's just a normal web request), so when SMTP_HOST points at
// Resend we send through that API instead of SMTP. Any other SMTP_HOST
// still goes through nodemailer/SMTP as before.
const USE_RESEND_API =
  !!process.env.SMTP_HOST?.toLowerCase().includes("resend.com") && !!process.env.SMTP_PASS;

// Extracts the raw email address out of a MAIL_FROM-style string, e.g.
// `"Nimblo" <no-reply@usenimblo.com>` -> `no-reply@usenimblo.com`. Falls
// back to treating the whole string as the address if there's no <...>.
function extractFromAddress(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/<([^>]+)>/);
  const address = (match ? match[1] : raw).trim();
  return address || null;
}

// Builds the "From" header for an invoice/quote email sent to one of a
// business's clients. SMTP_FROM (e.g. `"Nimblo" <no-reply@usenimblo.com>`)
// is always set in production because it's the only address that's
// actually verified to send mail (SPF/DKIM) — but showing "Nimblo" as the
// sender confuses clients who don't know what Nimblo is, they just want to
// see who invoiced them. So we keep the verified sending *address* but put
// the business's own name in the display name instead.
function buildFromHeader(businessName: string): string {
  const fromAddress = extractFromAddress(process.env.SMTP_FROM);
  if (!fromAddress) {
    // Nothing configured (local/dev) — fall back to the old behaviour.
    return process.env.SMTP_FROM || `"${businessName}" <no-reply@invoicing.local>`;
  }
  // Strip characters that would break the quoted display name in the header.
  const safeName = businessName.replace(/["<>]/g, "").trim() || "Nimblo";
  return `"${safeName} via Nimblo" <${fromAddress}>`;
}

type SendArgs = {
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

async function sendViaResendApi(args: SendArgs) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SMTP_PASS}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      reply_to: args.replyTo || undefined,
      attachments: args.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
      })),
    }),
    // Fail fast rather than hang — this is a plain HTTPS call so it should
    // normally resolve in well under a second.
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
  return res.json();
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      // Without these, a blocked/unreachable port hangs the underlying
      // socket for minutes before nodemailer's own default timeout kicks
      // in — which means a Server Action calling this just sits there,
      // and the user watches a "Sending…" button do nothing. Fail fast.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
  } else {
    // No SMTP configured: log emails to console instead of sending (dev fallback).
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

async function send(args: SendArgs) {
  if (USE_RESEND_API) return sendViaResendApi(args);

  const t = getTransporter();
  return t.sendMail({
    from: args.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    replyTo: args.replyTo,
    attachments: args.attachments,
  });
}

export async function sendInvoiceEmail(opts: {
  to: string;
  businessName: string;
  invoiceNumber: string;
  total: string;
  dueDate: string;
  pdfBuffer: Buffer;
  message?: string;
}) {
  const info = await send({
    from: buildFromHeader(opts.businessName),
    to: opts.to,
    subject: `Invoice ${opts.invoiceNumber} from ${opts.businessName}`,
    text:
      opts.message ||
      `Hi,\n\nPlease find attached invoice ${opts.invoiceNumber} for ${opts.total}, due ${opts.dueDate}.\n\nThank you,\n${opts.businessName}`,
    attachments: [
      {
        filename: buildPdfFilename(opts.businessName, opts.invoiceNumber),
        content: opts.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  if (!process.env.SMTP_HOST) {
    console.log(`[mailer] SMTP not configured — email logged only. To: ${opts.to}, Invoice: ${opts.invoiceNumber}`);
  }

  return info;
}

export async function sendQuoteEmail(opts: {
  to: string;
  businessName: string;
  quoteNumber: string;
  total: string;
  expiryDate: string;
  pdfBuffer: Buffer;
  message?: string;
}) {
  const info = await send({
    from: buildFromHeader(opts.businessName),
    to: opts.to,
    subject: `Quote ${opts.quoteNumber} from ${opts.businessName}`,
    text:
      opts.message ||
      `Hi,\n\nPlease find attached quote ${opts.quoteNumber} for ${opts.total}, valid until ${opts.expiryDate}.\n\nThank you,\n${opts.businessName}`,
    attachments: [
      {
        filename: buildPdfFilename(opts.businessName, opts.quoteNumber),
        content: opts.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  if (!process.env.SMTP_HOST) {
    console.log(`[mailer] SMTP not configured — email logged only. To: ${opts.to}, Quote: ${opts.quoteNumber}`);
  }

  return info;
}

// "Report a problem" notification, sent to the Nimblo operator (not a
// client of one of our businesses) — this one should keep saying "Nimblo",
// since it's an internal notification, not a client-facing invoice email.
// Set SUPPORT_NOTIFY_EMAIL on Railway to where these should land; falls
// back to SMTP_FROM's address if unset.
export async function sendSupportTicketEmail(opts: {
  businessName: string;
  businessEmail: string;
  userEmail?: string | null;
  message: string;
  pageUrl?: string | null;
  ticketId: string;
}) {
  const to = process.env.SUPPORT_NOTIFY_EMAIL || process.env.SMTP_FROM;
  if (!to) {
    console.log(`[mailer] No SUPPORT_NOTIFY_EMAIL/SMTP_FROM configured — support ticket ${opts.ticketId} logged only.`);
    return null;
  }

  const info = await send({
    from: process.env.SMTP_FROM || `"Nimblo" <no-reply@invoicing.local>`,
    to,
    replyTo: opts.userEmail || undefined,
    subject: `[Nimblo support] ${opts.businessName}`,
    text: [
      `Business: ${opts.businessName} (${opts.businessEmail})`,
      opts.userEmail ? `Reported by: ${opts.userEmail}` : null,
      opts.pageUrl ? `Page: ${opts.pageUrl}` : null,
      `Ticket ID: ${opts.ticketId}`,
      "",
      opts.message,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (!process.env.SMTP_HOST) {
    console.log(`[mailer] SMTP not configured — support ticket ${opts.ticketId} logged only.`);
  }

  return info;
}
