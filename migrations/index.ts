import * as migration_20260805_172254_product_discounts from './20260805_172254_product_discounts.ts';
import * as migration_20260806_172254_product_reviews from './20260806_172254_product_reviews.ts';
import * as migration_20260809_143900_sber_acquiring_settings from './20260809_143900_sber_acquiring_settings.ts';
import * as migration_20260809_145000_payment_settings from './20260809_145000_payment_settings.ts';
import * as migration_20260809_181500_retail_customer_fields from './20260809_181500_retail_customer_fields.ts';
import * as migration_20260810_120000_runtime_infrastructure from './20260810_120000_runtime_infrastructure.ts';
import * as migration_20260810_140000_coffee_profiles from './20260810_140000_coffee_profiles.ts';
import * as migration_20260810_150000_preference_source_fields from './20260810_150000_preference_source_fields.ts';
import * as migration_20260811_170000_repair_preference_source_fields from './20260811_170000_repair_preference_source_fields.ts';
import * as migration_20260811_180000_orders_returned_status from './20260811_180000_orders_returned_status.ts';
import * as migration_20260811_190000_product_merchandising_and_taste from './20260811_190000_product_merchandising_and_taste.ts';
import * as migration_20260811_200000_yookassa_settings from './20260811_200000_yookassa_settings.ts';
import * as migration_20260812_120000_sales_channels_and_admin_workspaces from './20260812_120000_sales_channels_and_admin_workspaces.ts';

export const migrations = [
  {
    up: migration_20260805_172254_product_discounts.up,
    down: migration_20260805_172254_product_discounts.down,
    name: '20260805_172254_product_discounts'
  },
  {
    up: migration_20260806_172254_product_reviews.up,
    down: migration_20260806_172254_product_reviews.down,
    name: '20260806_172254_product_reviews'
  },
  {
    up: migration_20260809_143900_sber_acquiring_settings.up,
    down: migration_20260809_143900_sber_acquiring_settings.down,
    name: '20260809_143900_sber_acquiring_settings'
  },
  {
    up: migration_20260809_145000_payment_settings.up,
    down: migration_20260809_145000_payment_settings.down,
    name: '20260809_145000_payment_settings'
  },
  {
    up: migration_20260809_181500_retail_customer_fields.up,
    down: migration_20260809_181500_retail_customer_fields.down,
    name: '20260809_181500_retail_customer_fields'
  },
  {
    up: migration_20260810_120000_runtime_infrastructure.up,
    down: migration_20260810_120000_runtime_infrastructure.down,
    name: '20260810_120000_runtime_infrastructure'
  },
  {
    up: migration_20260810_140000_coffee_profiles.up,
    down: migration_20260810_140000_coffee_profiles.down,
    name: '20260810_140000_coffee_profiles'
  },
  {
    up: migration_20260810_150000_preference_source_fields.up,
    down: migration_20260810_150000_preference_source_fields.down,
    name: '20260810_150000_preference_source_fields'
  },
  {
    up: migration_20260811_170000_repair_preference_source_fields.up,
    down: migration_20260811_170000_repair_preference_source_fields.down,
    name: '20260811_170000_repair_preference_source_fields'
  },
  {
    up: migration_20260811_180000_orders_returned_status.up,
    down: migration_20260811_180000_orders_returned_status.down,
    name: '20260811_180000_orders_returned_status'
  },
  {
    up: migration_20260811_190000_product_merchandising_and_taste.up,
    down: migration_20260811_190000_product_merchandising_and_taste.down,
    name: '20260811_190000_product_merchandising_and_taste'
  },
  {
    up: migration_20260811_200000_yookassa_settings.up,
    down: migration_20260811_200000_yookassa_settings.down,
    name: '20260811_200000_yookassa_settings'
  },
  {
    up: migration_20260812_120000_sales_channels_and_admin_workspaces.up,
    down: migration_20260812_120000_sales_channels_and_admin_workspaces.down,
    name: '20260812_120000_sales_channels_and_admin_workspaces'
  },
];
