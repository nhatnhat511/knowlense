"use client";

import type { YearlyUpgradePreview } from "@/lib/api/billing";

type YearlyUpgradeConfirmationModalProps = {
  dark?: boolean;
  preview: YearlyUpgradePreview;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatBillingMoney(value: string | null, currencyCode: string | null) {
  if (!value || !currencyCode) {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(amount / 100);
}

function formatBillingDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function YearlyUpgradeConfirmationModal({
  dark = false,
  preview,
  busy,
  onClose,
  onConfirm
}: YearlyUpgradeConfirmationModalProps) {
  const previewChargeTodayLabel = formatBillingMoney(
    preview.updateSummary?.resultTotal ?? preview.immediateTransaction?.total ?? null,
    preview.currencyCode ?? null
  );
  const previewYearlyTotalLabel = formatBillingMoney(
    preview.recurringTransaction?.total ?? null,
    preview.currencyCode ?? null
  );
  const previewChargeTodaySubtotalLabel = formatBillingMoney(
    preview.immediateTransaction?.subtotal ?? null,
    preview.currencyCode ?? null
  );
  const previewChargeTodayTaxLabel = formatBillingMoney(
    preview.immediateTransaction?.tax ?? null,
    preview.currencyCode ?? null
  );
  const previewYearlySubtotalLabel = formatBillingMoney(
    preview.recurringTransaction?.subtotal ?? null,
    preview.currencyCode ?? null
  );
  const previewYearlyTaxLabel = formatBillingMoney(
    preview.recurringTransaction?.tax ?? null,
    preview.currencyCode ?? null
  );
  const previewCreditLabel = formatBillingMoney(
    preview.updateSummary?.creditTotal ?? null,
    preview.currencyCode ?? null
  );
  const previewChargeLabel = formatBillingMoney(
    preview.updateSummary?.chargeTotal ?? null,
    preview.currencyCode ?? null
  );
  const previewNextBillingLabel = formatBillingDate(preview.nextBilledAt ?? null);
  const previewPaymentMethodLabel =
    preview.collectionMode === "automatic"
      ? preview.paymentMethodSummary?.label ?? "Saved payment method"
      : preview.collectionMode === "manual"
        ? "Manual collection"
        : "Unavailable";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-8">
      <div className={cn("w-full max-w-[520px] rounded-[28px] border p-5 shadow-[0_32px_90px_rgba(15,23,42,0.22)] sm:p-6", dark ? "border-white/10 bg-[#111318]" : "border-[#e7e1d5] bg-[#fffdf9]")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={cn("text-[0.78rem] font-semibold uppercase tracking-[0.18em]", dark ? "text-white/35" : "text-[#8b7f70]")}>Billing confirmation</div>
            <h2 className={cn("mt-2 text-[1.55rem] font-bold tracking-[-0.03em]", dark ? "text-white" : "text-gray-900")}>Confirm your yearly upgrade</h2>
            <p className={cn("mt-2 text-sm leading-6", dark ? "text-white/60" : "text-gray-600")}>
              This estimate is provided by Paddle before the plan change is applied. Confirm to charge the payment method on file now and move future renewals to annual billing.
            </p>
          </div>
          <button
            className={cn("inline-flex h-10 w-10 items-center justify-center rounded-full border text-xl leading-none transition", dark ? "border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white" : "border-black/10 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900")}
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className={cn("rounded-[22px] border px-4 py-3", dark ? "border-amber-300/20 bg-amber-300/10" : "border-amber-200 bg-amber-50/90")}>
            <div className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", dark ? "text-amber-100/70" : "text-amber-700/80")}>Charge today</div>
            <div className={cn("mt-1 text-[1.2rem] font-semibold", dark ? "text-amber-100" : "text-amber-950")}>{previewChargeTodayLabel ?? "Calculated by Paddle at confirmation"}</div>
            {previewChargeTodayTaxLabel || previewChargeTodaySubtotalLabel ? (
              <div className={cn("mt-2 text-xs leading-5", dark ? "text-amber-100/75" : "text-amber-800/85")}>
                {previewChargeTodaySubtotalLabel ? <div>Subtotal: {previewChargeTodaySubtotalLabel}</div> : null}
                {previewChargeTodayTaxLabel ? <div>Tax: {previewChargeTodayTaxLabel}</div> : null}
              </div>
            ) : null}
          </div>
          <div className={cn("rounded-[22px] border px-4 py-3", dark ? "border-emerald-300/20 bg-emerald-300/10" : "border-emerald-200 bg-emerald-50/90")}>
            <div className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", dark ? "text-emerald-100/70" : "text-emerald-700/80")}>Future renewal</div>
            <div className={cn("mt-1 text-[1.2rem] font-semibold", dark ? "text-emerald-100" : "text-emerald-950")}>{previewYearlyTotalLabel ?? "Calculated by Paddle"}</div>
            {previewYearlyTaxLabel || previewYearlySubtotalLabel ? (
              <div className={cn("mt-2 text-xs leading-5", dark ? "text-emerald-100/75" : "text-emerald-800/85")}>
                {previewYearlySubtotalLabel ? <div>Subtotal: {previewYearlySubtotalLabel}</div> : null}
                {previewYearlyTaxLabel ? <div>Tax: {previewYearlyTaxLabel}</div> : null}
              </div>
            ) : null}
          </div>
          <div className={cn("rounded-[22px] border px-4 py-3", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")}>
            <div className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", dark ? "text-white/45" : "text-neutral-500")}>Next renewal date</div>
            <div className={cn("mt-1 text-base font-semibold", dark ? "text-white" : "text-gray-900")}>{previewNextBillingLabel ?? "Unavailable"}</div>
          </div>
          <div className={cn("rounded-[22px] border px-4 py-3", dark ? "border-white/10 bg-white/5" : "border-black/8 bg-[#fafafa]")}>
            <div className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", dark ? "text-white/45" : "text-neutral-500")}>Payment method on file</div>
            <div className={cn("mt-1 text-base font-semibold", dark ? "text-white" : "text-gray-900")}>{previewPaymentMethodLabel}</div>
          </div>
        </div>

        <div className={cn("mt-4 rounded-[22px] border px-4 py-4 text-sm leading-6", dark ? "border-white/10 bg-white/5 text-white/70" : "border-black/8 bg-[#fafafa] text-gray-600")}>
          <p>The update will switch this subscription from Premium Monthly to Premium Yearly using Paddle proration.</p>
          <p>Tax is included in the totals above whenever Paddle applies tax to this subscription.</p>
          <p>{previewChargeLabel ? `Prorated charges: ${previewChargeLabel}.` : "Prorated charges will be calculated by Paddle."} {previewCreditLabel ? `Prorated credits: ${previewCreditLabel}.` : ""}</p>
          {preview.consentRequirementsCount > 0 ? <p className={cn("mt-2 font-medium", dark ? "text-amber-200" : "text-amber-800")}>Paddle reported additional consent requirements for this billing period. Review carefully before confirming.</p> : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className={cn("inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold transition", dark ? "bg-white text-gray-900 hover:bg-gray-100 disabled:bg-white/60" : "bg-gray-900 text-white hover:bg-black disabled:bg-gray-400")}
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? "Applying upgrade..." : "Confirm and charge"}
          </button>
          <button
            className={cn("inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium transition", dark ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-black/10 bg-white text-black hover:bg-neutral-50")}
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
