export const STATUS_LABEL = {
  PLACED: 'Placed',
  PREPARING: 'Preparing',
  READY: 'Ready for pickup',
  COLLECTED: 'Delivered',
  CANCELLED: 'Cancelled',
};

// Statuses an admin or kitchen can move an order to from each stage
export const NEXT_STATUSES = {
  PLACED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COLLECTED'],
  COLLECTED: [],
  CANCELLED: [],
};

export const money = (n) => `₹${Number(n).toFixed(2)}`;

export const minutesSince = (iso) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
