import { formatINR } from "@/lib/domain/money";

export type TemplateVars = {
  customerName: string;
  invoiceNumber: string;
  outstandingPaise: number;
  dueDate: string;
  daysOverdue: number;
  ownerName: string;
  ownerPhone: string;
};

export type RenderedMessage = { subject: string; body: string };

const footer = (v: TemplateVars) =>
  `Questions? Call ${v.ownerName}: ${v.ownerPhone}`;

export const templatesEN: Record<string, (v: TemplateVars) => RenderedMessage> = {
  headsUp: (v) => ({
    subject: `Heads-up: ${v.invoiceNumber} due ${v.dueDate}`,
    body:
      `Hi ${v.customerName},\n\n` +
      `Invoice ${v.invoiceNumber} for ${formatINR(v.outstandingPaise)} is due on ${v.dueDate}. ` +
      `Just a heads-up to arrange payment.\n\n` +
      footer(v),
  }),
  dueDate: (v) => ({
    subject: `Due today: ${v.invoiceNumber} · ${formatINR(v.outstandingPaise)}`,
    body:
      `Hi ${v.customerName},\n\n` +
      `Invoice ${v.invoiceNumber} for ${formatINR(v.outstandingPaise)} is due today.\n\n` +
      footer(v),
  }),
  firm: (v) => ({
    subject: `Payment overdue: ${v.invoiceNumber} · ${v.daysOverdue}d late`,
    body:
      `Hi ${v.customerName},\n\n` +
      `Invoice ${v.invoiceNumber} for ${formatINR(v.outstandingPaise)} is now ${v.daysOverdue} days overdue. ` +
      `Please arrange payment this week.\n\n` +
      footer(v),
  }),
  finalCall: (v) => ({
    subject: `Overdue ${v.daysOverdue}d: ${v.invoiceNumber}`,
    body:
      `Hi ${v.customerName},\n\n` +
      `Invoice ${v.invoiceNumber} for ${formatINR(v.outstandingPaise)} is now ${v.daysOverdue} days overdue. ` +
      `Please arrange payment or contact us to discuss.\n\n` +
      footer(v),
  }),
  demandLetter: (v) => ({
    subject: `Formal payment request: ${v.invoiceNumber}`,
    body:
      `Hi ${v.customerName},\n\n` +
      `Invoice ${v.invoiceNumber} for ${formatINR(v.outstandingPaise)} remains unpaid at ${v.daysOverdue} days overdue. ` +
      `A formal payment demand letter has been prepared. Please contact us to resolve this.\n\n` +
      footer(v),
  }),
  nextSteps: (v) => ({
    subject: `Overdue ${v.daysOverdue}d: ${v.invoiceNumber} — please respond`,
    body:
      `Hi ${v.customerName},\n\n` +
      `Invoice ${v.invoiceNumber} for ${formatINR(v.outstandingPaise)} is now ${v.daysOverdue} days overdue. ` +
      `We are considering further action. Please contact us immediately.\n\n` +
      footer(v),
  }),
};
