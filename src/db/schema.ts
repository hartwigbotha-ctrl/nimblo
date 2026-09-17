import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// ---------- Helpers ----------
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
};

// ---------- Businesses (tenants) ----------
export const businesses = sqliteTable("businesses", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  vatNumber: text("vat_number"),
  regNumber: text("reg_number"),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color").notNull().default("#111827"),
  pdfTemplate: text("pdf_template").notNull().default("modern"), // modern | classic | minimal
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  nextInvoiceSeq: integer("next_invoice_seq").notNull().default(1),
  quotePrefix: text("quote_prefix").notNull().default("QUO"),
  nextQuoteSeq: integer("next_quote_seq").notNull().default(1),
  currency: text("currency").notNull().default("ZAR"),
  defaultTaxRate: real("default_tax_rate").notNull().default(15), // % VAT default
  bankDetails: text("bank_details"), // free text: bank, account, branch code
  paymentTermsDays: integer("payment_terms_days").notNull().default(7),
  ...timestamps,
});

export const businessesRelations = relations(businesses, ({ many }) => ({
  users: many(users),
  clients: many(clients),
  items: many(items),
  invoices: many(invoices),
  quotes: many(quotes),
  recurringSchedules: many(recurringSchedules),
  subscriptions: many(subscriptions),
  documentImports: many(documentImports),
  supportTickets: many(supportTickets),
}));

// ---------- Users ----------
export const users = sqliteTable("users", {
  id: id(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("owner"), // owner | staff
  ...timestamps,
});

export const usersRelations = relations(users, ({ one }) => ({
  business: one(businesses, {
    fields: [users.businessId],
    references: [businesses.id],
  }),
}));

// ---------- Clients ----------
export const clients = sqliteTable("clients", {
  id: id(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  // Additional email addresses beyond the primary one above, stored as a
  // JSON array of strings (e.g. '["accounts@acme.com","jane@acme.com"]').
  // The primary `email` column is still what's used for sending invoices/
  // quotes and shown on PDFs — these are just extra contacts to keep on file.
  extraEmails: text("extra_emails"),
  address: text("address"), // billing address
  contactName: text("contact_name"),
  phone: text("phone"),
  // Additional phone numbers beyond the primary one above, same JSON-array
  // format as extraEmails.
  extraPhones: text("extra_phones"),
  mobile: text("mobile"),
  website: text("website"),
  vatNumber: text("vat_number"), // tax number
  customPaymentTermsDays: integer("custom_payment_terms_days"), // null = business default
  notes: text("notes"),
  ...timestamps,
});

export const clientsRelations = relations(clients, ({ one, many }) => ({
  business: one(businesses, {
    fields: [clients.businessId],
    references: [businesses.id],
  }),
  invoices: many(invoices),
  quotes: many(quotes),
  recurringSchedules: many(recurringSchedules),
}));

// ---------- Saved items / services catalog ----------
export const items = sqliteTable("items", {
  id: id(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  code: text("code"), // optional SKU/reference code, e.g. "Metro Fibre - PTP"
  name: text("name").notNull(),
  description: text("description"),
  defaultPrice: real("default_price").notNull().default(0), // "Rate"
  cost: real("cost").notNull().default(0),
  unitType: text("unit_type"), // e.g. Hours, Days, Units — null = None
  taxable: integer("taxable", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const itemsRelations = relations(items, ({ one }) => ({
  business: one(businesses, {
    fields: [items.businessId],
    references: [businesses.id],
  }),
}));

// ---------- Recurring schedules ----------
export const recurringSchedules = sqliteTable("recurring_schedules", {
  id: id(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // e.g. "Monthly retainer"
  frequency: text("frequency").notNull(), // weekly | monthly | quarterly | annually
  intervalCount: integer("interval_count").notNull().default(1),
  startDate: text("start_date").notNull(), // ISO date
  nextRunDate: text("next_run_date").notNull(), // ISO date
  endDate: text("end_date"), // ISO date, nullable = never
  autoSend: integer("auto_send", { mode: "boolean" }).notNull().default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  taxRate: real("tax_rate"), // overrides business default if set
  notes: text("notes"),
  lineItemsJson: text("line_items_json").notNull(), // JSON array of {description, quantity, unitPrice}
  lastRunAt: text("last_run_at"),
  ...timestamps,
});

export const recurringSchedulesRelations = relations(
  recurringSchedules,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [recurringSchedules.businessId],
      references: [businesses.id],
    }),
    client: one(clients, {
      fields: [recurringSchedules.clientId],
      references: [clients.id],
    }),
    invoices: many(invoices),
  })
);

// ---------- Invoices ----------
export const invoices = sqliteTable("invoices", {
  id: id(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  recurringScheduleId: text("recurring_schedule_id").references(
    () => recurringSchedules.id,
    { onDelete: "set null" }
  ),
  number: text("number").notNull(), // e.g. INV-0001
  status: text("status").notNull().default("draft"), // draft|sent|paid|overdue|cancelled
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  currency: text("currency").notNull().default("ZAR"),
  subtotal: real("subtotal").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
  taxAmount: real("tax_amount").notNull().default(0),
  total: real("total").notNull().default(0),
  amountPaid: real("amount_paid").notNull().default(0),
  notes: text("notes"),
  sentAt: text("sent_at"),
  paidAt: text("paid_at"),
  ...timestamps,
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  business: one(businesses, {
    fields: [invoices.businessId],
    references: [businesses.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  recurringSchedule: one(recurringSchedules, {
    fields: [invoices.recurringScheduleId],
    references: [recurringSchedules.id],
  }),
  lineItems: many(invoiceLineItems),
  payments: many(payments),
}));

// ---------- Invoice line items ----------
export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: id(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  amount: real("amount").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const invoiceLineItemsRelations = relations(
  invoiceLineItems,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [invoiceLineItems.invoiceId],
      references: [invoices.id],
    }),
  })
);

// ---------- Quotes / Estimates ----------
export const quotes = sqliteTable("quotes", {
  id: id(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  number: text("number").notNull(), // e.g. QUO-0001
  status: text("status").notNull().default("draft"), // draft|sent|accepted|declined|expired
  issueDate: text("issue_date").notNull(),
  expiryDate: text("expiry_date").notNull(),
  currency: text("currency").notNull().default("ZAR"),
  subtotal: real("subtotal").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
  taxAmount: real("tax_amount").notNull().default(0),
  total: real("total").notNull().default(0),
  notes: text("notes"),
  sentAt: text("sent_at"),
  respondedAt: text("responded_at"),
  convertedInvoiceId: text("converted_invoice_id").references(() => invoices.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  business: one(businesses, {
    fields: [quotes.businessId],
    references: [businesses.id],
  }),
  client: one(clients, {
    fields: [quotes.clientId],
    references: [clients.id],
  }),
  lineItems: many(quoteLineItems),
  convertedInvoice: one(invoices, {
    fields: [quotes.convertedInvoiceId],
    references: [invoices.id],
  }),
}));

export const quoteLineItems = sqliteTable("quote_line_items", {
  id: id(),
  quoteId: text("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  amount: real("amount").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const quoteLineItemsRelations = relations(quoteLineItems, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteLineItems.quoteId],
    references: [quotes.id],
  }),
}));

// ---------- Payments ----------
export const payments = sqliteTable("payments", {
  id: id(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  method: text("method").notNull().default("manual"), // manual|payfast|stripe|eft
  reference: text("reference"),
  paidAt: text("paid_at").notNull(),
  ...timestamps,
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

// ---------- SaaS subscription plans (for the app's own monthly billing) ----------
export const plans = sqliteTable("plans", {
  id: id(),
  name: text("name").notNull(), // Starter | Pro | Business
  priceMonthly: real("price_monthly").notNull(),
  currency: text("currency").notNull().default("ZAR"),
  invoiceLimit: integer("invoice_limit"), // null = unlimited
  clientLimit: integer("client_limit"), // null = unlimited
  features: text("features").notNull().default("[]"), // JSON array of strings
  ...timestamps,
});

export const subscriptions = sqliteTable("subscriptions", {
  id: id(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  status: text("status").notNull().default("trialing"), // incomplete|trialing|active|past_due|canceled
  provider: text("provider"), // payfast|stripe|null (manual)
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"), // PayFast recurring "token" (pf_payment_id's associated token) used to cancel/manage
  // Our own reference sent as m_payment_id on the PayFast checkout that
  // created this row, so the ITN webhook can find the right subscription
  // even before the first payment has confirmed and we have a token yet.
  checkoutReference: text("checkout_reference"),
  trialEndsAt: text("trial_ends_at"),
  currentPeriodStart: text("current_period_start"),
  currentPeriodEnd: text("current_period_end"),
  canceledAt: text("canceled_at"),
  ...timestamps,
});

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  business: one(businesses, {
    fields: [subscriptions.businessId],
    references: [businesses.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
  payments: many(subscriptionPayments),
}));

// ---------- Subscription billing events (PayFast ITN log) ----------
// One row per PayFast Instant Transaction Notification we receive for a
// SaaS subscription payment. This is an audit trail — if a payment is
// missed or disputed we can see exactly what PayFast told us and when,
// separate from the `payments` table (which is for a business's own
// client invoice payments, not their subscription to Nimblo itself).
export const subscriptionPayments = sqliteTable("subscription_payments", {
  id: id(),
  subscriptionId: text("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  pfPaymentId: text("pf_payment_id").notNull().unique(), // PayFast's pf_payment_id — dedupes retried ITNs
  paymentStatus: text("payment_status").notNull(), // COMPLETE|FAILED|CANCELLED (PayFast's payment_status value)
  amountGross: real("amount_gross").notNull().default(0),
  rawPayload: text("raw_payload").notNull(), // JSON of the full ITN fields, for debugging/disputes
  receivedAt: text("received_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [subscriptionPayments.subscriptionId],
    references: [subscriptions.id],
  }),
}));

// ---------- Document imports (Pro/Business: bulk-migrate old invoices/quotes) ----------
// A row is created per uploaded file (Word/PDF/Excel/scanned image). An AI
// extraction pass fills extractedJson with a best-effort parse of client,
// line items, dates and totals; the user reviews/edits that before it's
// turned into a real invoice or quote via confirmImport().
export const documentImports = sqliteTable("document_imports", {
  id: id(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  status: text("status").notNull().default("pending"), // pending|imported|discarded|failed
  docType: text("doc_type").notNull().default("invoice"), // invoice | quote
  extractedJson: text("extracted_json").notNull(), // best-effort AI-parsed payload, editable before confirm
  matchedClientId: text("matched_client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  createdInvoiceId: text("created_invoice_id").references(() => invoices.id, {
    onDelete: "set null",
  }),
  createdQuoteId: text("created_quote_id").references(() => quotes.id, {
    onDelete: "set null",
  }),
  errorMessage: text("error_message"),
  ...timestamps,
});

export const documentImportsRelations = relations(documentImports, ({ one }) => ({
  business: one(businesses, {
    fields: [documentImports.businessId],
    references: [businesses.id],
  }),
  matchedClient: one(clients, {
    fields: [documentImports.matchedClientId],
    references: [clients.id],
  }),
}));

// ---------- Support tickets ("Report a problem") ----------
// A logged-in Nimblo account holder (a contractor/small business using the app —
// not one of their end-invoice-recipients) can report an issue. It's
// emailed straight to the Nimblo operator; the row here is just a
// record of what was sent and when, so nothing is lost if the email
// bounces or gets missed.
export const supportTickets = sqliteTable("support_tickets", {
  id: id(),
  businessId: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  pageUrl: text("page_url"),
  status: text("status").notNull().default("open"), // open | resolved
  emailedOk: integer("emailed_ok", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  business: one(businesses, {
    fields: [supportTickets.businessId],
    references: [businesses.id],
  }),
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
}));
