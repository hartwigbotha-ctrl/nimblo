import { requireBusiness } from "@/lib/session";
import { updateBusinessSettings, setPlanManually } from "@/lib/actions/settings";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { CancelSubscriptionButton } from "./cancel-subscription-button";
import { LogoControls } from "./logo-controls";

export default async function SettingsPage() {
  const { business } = await requireBusiness();

  const [subscription, allPlans] = await Promise.all([
    db.query.subscriptions.findFirst({
      where: eq(subscriptions.businessId, business.id),
      with: { plan: true },
      orderBy: desc(subscriptions.createdAt),
    }),
    db.query.plans.findMany(),
  ]);

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-600 mt-1">
          Your business details appear on every invoice PDF.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="font-semibold mb-3">Subscription</h2>
        {subscription ? (
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">{subscription.plan.name}</p>
              <p className="text-gray-500">
                {subscription.plan.currency} {subscription.plan.priceMonthly.toFixed(2)} / month
              </p>
              {subscription.status === "active" && subscription.currentPeriodEnd && (
                <p className="text-xs text-gray-400 mt-1">
                  Next billing date: {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-ZA")}
                </p>
              )}
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                subscription.status === "active"
                  ? "bg-green-100 text-green-700"
                  : subscription.status === "past_due"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {subscription.status}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No active plan yet.</p>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
          <Link href="/billing/subscribe" className="text-sm font-medium text-gray-900 hover:underline">
            {subscription?.status === "active" ? "Change plan" : "Choose a plan"}
          </Link>
          {subscription?.status === "active" && subscription.providerSubscriptionId && (
            <CancelSubscriptionButton />
          )}
        </div>

        {/* Manual override — kept as an admin/testing fallback now that PayFast checkout is live. */}
        <form action={setPlanManually} className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
          <label htmlFor="planName" className="text-xs text-gray-500">
            Set plan manually (admin/testing only):
          </label>
          <select
            id="planName"
            name="planName"
            defaultValue={subscription?.plan.name ?? ""}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {allPlans.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name} — R{p.priceMonthly}/mo
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800"
          >
            Update
          </button>
        </form>
      </div>

      <form
        action={updateBusinessSettings}
        encType="multipart/form-data"
        className="bg-white border border-gray-200 rounded-lg p-6 space-y-6"
      >
        <div>
          <h2 className="font-semibold mb-3">Branding</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <LogoControls
              logoUrl={business.logoUrl}
              initialHeight={business.logoHeight}
              initialAlign={business.logoAlign}
            />

            <div>
              <label htmlFor="brandColor" className="block text-sm font-medium text-gray-700 mb-1">
                Brand color
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="brandColor"
                  type="color"
                  name="brandColor"
                  defaultValue={business.brandColor}
                  className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                />
                <span className="text-sm text-gray-500">Used for headings and accents on invoices</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Invoice layout</label>
            <div className="grid sm:grid-cols-3 gap-3">
              <TemplateOption
                value="modern"
                label="Modern"
                description="Shaded table header, bold accents"
                current={business.pdfTemplate}
              />
              <TemplateOption
                value="classic"
                label="Classic"
                description="Centered header, serif-style"
                current={business.pdfTemplate}
              />
              <TemplateOption
                value="minimal"
                label="Minimal"
                description="Clean lines, no fills"
                current={business.pdfTemplate}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="font-semibold mb-3">Business details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field name="name" label="Business name" defaultValue={business.name} required />
            <Field name="email" label="Email" type="email" defaultValue={business.email} required />
            <Field name="phone" label="Phone" defaultValue={business.phone ?? ""} />
            <Field name="vatNumber" label="VAT number" defaultValue={business.vatNumber ?? ""} />
            <Field name="regNumber" label="Registration number" defaultValue={business.regNumber ?? ""} />
            <Field name="currency" label="Currency (e.g. ZAR, USD, EUR, GBP)" defaultValue={business.currency} />
            <Field
              name="invoicePrefix"
              label="Invoice number prefix"
              defaultValue={business.invoicePrefix}
            />
            <Field
              name="nextInvoiceSeq"
              label="Next invoice number"
              type="number"
              min={1}
              defaultValue={String(business.nextInvoiceSeq)}
              help="Already using invoice numbers elsewhere? Set this to continue from where you left off."
            />
            <Field
              name="quotePrefix"
              label="Quote number prefix"
              defaultValue={business.quotePrefix}
            />
            <Field
              name="nextQuoteSeq"
              label="Next quote number"
              type="number"
              min={1}
              defaultValue={String(business.nextQuoteSeq)}
              help="Same idea, for quotes."
            />
            <Field
              name="defaultTaxRate"
              label="VAT rate (%)"
              type="number"
              min={0}
              defaultValue={String(business.defaultTaxRate)}
              help="Not registered for VAT? Leave this at 0 — you're not required to charge it."
            />
            <Field
              name="paymentTermsDays"
              label="Default payment terms (days)"
              type="number"
              min={0}
              defaultValue={String(business.paymentTermsDays)}
            />
          </div>

          <div className="mt-4 space-y-4">
            <Field name="address" label="Address" defaultValue={business.address ?? ""} textarea />
            <Field
              name="bankDetails"
              label="Bank / payment details (shown on invoices)"
              defaultValue={business.bankDetails ?? ""}
              textarea
            />
          </div>
        </div>

        <button
          type="submit"
          className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
        >
          Save settings
        </button>
      </form>
    </div>
  );
}

function TemplateOption({
  value,
  label,
  description,
  current,
}: {
  value: string;
  label: string;
  description: string;
  current: string;
}) {
  const checked = current === value;
  return (
    <label
      className={`flex flex-col gap-1 rounded-md border p-3 cursor-pointer text-sm ${
        checked ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <input type="radio" name="pdfTemplate" value={value} defaultChecked={checked} />
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-xs text-gray-500">{description}</span>
    </label>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required,
  textarea,
  help,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  textarea?: boolean;
  help?: string;
  min?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          min={type === "number" ? min : undefined}
          defaultValue={defaultValue}
          required={required}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      )}
      {help && <p className="text-xs text-gray-500 mt-1">{help}</p>}
    </div>
  );
}
