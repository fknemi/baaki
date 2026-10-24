// src/lib/i18n/hi.ts
import type { DictShape } from './en';

const hi: DictShape = {
    common: {
        save: 'सहेजें',
        cancel: 'रद्द करें',
        delete: 'हटाएं',
        loading: 'लोड हो रहा है…',
    },
    nav: {
        dashboard: 'डैशबोर्ड',
        invoices: 'इनवॉइस',
        customers: 'ग्राहक',
        payments: 'भुगतान',
        settings: 'सेटिंग्स',
        signOut: 'साइन आउट',
    },
    dashboard: {
        greeting: 'नमस्ते, {name}',
        totalOutstanding: 'कुल बकाया',
        invoicesOverdue: 'अतिदेय: {count}',
    },
    settings: {
        language: 'भाषा',
        language_en: 'अंग्रेज़ी',
        language_hi: 'हिन्दी',
        text_size: 'टेक्स्ट आकार',
        text_size_100: '100%',
        text_size_115: '115%',
        text_size_130: '130%',
        high_contrast: 'हाई कंट्रास्ट',
        demo_date: 'डेमो तारीख',
        demo_plus7: '+7 दिन',
        demo_plus15: '+15 दिन',
        demo_plus30: '+30 दिन',
        demo_today: 'आज',
    },
}
export default hi;
