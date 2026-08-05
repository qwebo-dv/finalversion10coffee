import * as migration_20260805_172254_product_discounts from './20260805_172254_product_discounts';

export const migrations = [
  {
    up: migration_20260805_172254_product_discounts.up,
    down: migration_20260805_172254_product_discounts.down,
    name: '20260805_172254_product_discounts'
  },
];
