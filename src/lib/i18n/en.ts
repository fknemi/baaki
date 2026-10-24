// src/lib/i18n/en.ts
const en = {
    common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        loading: 'Loading…',
    },
    nav: {
        dashboard: 'Dashboard',
        invoices: 'Invoices',
        customers: 'Customers',
        payments: 'Payments',
        settings: 'Settings',
        signOut: 'Sign out',
    },
    dashboard: {
        greeting: 'Hello, {name}',
        totalOutstanding: 'Total outstanding',
        invoicesOverdue: 'Overdue: {count}',
    },

    settings: {
        language: 'Language',
        language_en: 'English',
        language_hi: 'Hindi',
        text_size: 'Text size',
        text_size_100: '100%',
        text_size_115: '115%',
        text_size_130: '130%',
        high_contrast: 'High contrast',
        demo_date: 'Demo date',
        demo_plus7: '+7 days',
        demo_plus15: '+15 days',
        demo_plus30: '+30 days',
        demo_today: 'Today',
    },
} as const;
export type Dict = typeof en;        // literal types, used for TKey
export type DictShape = {            // string types, used for translations
    [K in keyof Dict]: { [J in keyof Dict[K]]: string }
};
export default en;
