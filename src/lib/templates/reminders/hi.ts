import { formatINR } from "@/lib/domain/money";
import type { TemplateVars, RenderedMessage } from "./en";

const footer = (v: TemplateVars) => `सवाल? ${v.ownerName} को कॉल करें: ${v.ownerPhone}`;

export const templatesHI: Record<string, (v: TemplateVars) => RenderedMessage> = {
  headsUp: (v) => ({
    subject: `सूचना: ${v.invoiceNumber} की देय तारीख ${v.dueDate}`,
    body:
      `नमस्ते ${v.customerName} जी,\n\n` +
      `इनवॉइस ${v.invoiceNumber} के लिए ${formatINR(v.outstandingPaise)} ${v.dueDate} को देय है। ` +
      `कृपया भुगतान की व्यवस्था करें।\n\n` +
      footer(v),
  }),
  dueDate: (v) => ({
    subject: `आज देय: ${v.invoiceNumber} · ${formatINR(v.outstandingPaise)}`,
    body:
      `नमस्ते ${v.customerName} जी,\n\n` +
      `इनवॉइस ${v.invoiceNumber} के लिए ${formatINR(v.outstandingPaise)} आज देय है।\n\n` +
      footer(v),
  }),
  firm: (v) => ({
    subject: `भुगतान बकाया: ${v.invoiceNumber} · ${v.daysOverdue} दिन देरी`,
    body:
      `नमस्ते ${v.customerName} जी,\n\n` +
      `इनवॉइस ${v.invoiceNumber} के लिए ${formatINR(v.outstandingPaise)} अब ${v.daysOverdue} दिन बकाया है। ` +
      `कृपया इस हफ्ते भुगतान करें।\n\n` +
      footer(v),
  }),
  finalCall: (v) => ({
    subject: `${v.daysOverdue} दिन बकाया: ${v.invoiceNumber}`,
    body:
      `नमस्ते ${v.customerName} जी,\n\n` +
      `इनवॉइस ${v.invoiceNumber} के लिए ${formatINR(v.outstandingPaise)} अब ${v.daysOverdue} दिन बकाया है। ` +
      `कृपया भुगतान करें या हमसे संपर्क करें।\n\n` +
      footer(v),
  }),
  demandLetter: (v) => ({
    subject: `औपचारिक भुगतान अनुरोध: ${v.invoiceNumber}`,
    body:
      `नमस्ते ${v.customerName} जी,\n\n` +
      `इनवॉइस ${v.invoiceNumber} के लिए ${formatINR(v.outstandingPaise)} ${v.daysOverdue} दिन से बकाया है। ` +
      `औपचारिक भुगतान मांग पत्र तैयार है। कृपया संपर्क करें।\n\n` +
      footer(v),
  }),
  nextSteps: (v) => ({
    subject: `${v.daysOverdue} दिन बकाया: ${v.invoiceNumber} — कृपया जवाब दें`,
    body:
      `नमस्ते ${v.customerName} जी,\n\n` +
      `इनवॉइस ${v.invoiceNumber} के लिए ${formatINR(v.outstandingPaise)} अब ${v.daysOverdue} दिन बकाया है। ` +
      `हम आगे की कार्रवाई पर विचार कर रहे हैं। कृपया तुरंत संपर्क करें।\n\n` +
      footer(v),
  }),
};
