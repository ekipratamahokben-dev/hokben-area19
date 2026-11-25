export const rp = (n) => (n == null ? "-" : Math.round(Number(n)).toLocaleString("id-ID"));
export const pct = (n, d = 1) => (n == null ? "-" : (Number(n) * 100).toLocaleString("id-ID", { maximumFractionDigits: d }) + "%");
export const num2 = (n) => (n == null ? "-" : Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 }));
export const todayJkt = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
export const CHANNELS = [
  ["birthday", "Birthday"], ["dine_in", "Dine in"], ["delivery_hokben", "Delivery Hokben"], ["expo", "Expo"],
  ["take_away", "Take away"], ["drive_thru", "Drive thru"], ["gofood", "GoFood"], ["grab", "GrabFood"], ["shopee", "ShopeeFood"],
];
