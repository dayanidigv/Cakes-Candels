declare const process: any;
export const appName = "Cakes & Candles ERP";
export const env = typeof process !== 'undefined' && process.env ? process.env.NODE_ENV : "development";
