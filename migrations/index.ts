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
import * as migration_20260812_210000_paid_order_confirmation_email from './20260812_210000_paid_order_confirmation_email.ts';
import * as migration_20260812_220000_product_review_authors from './20260812_220000_product_review_authors.ts';
import * as migration_20260813_090000_faqs from './20260813_090000_faqs.ts';
import * as migration_20260813_100000_repair_faqs_locked_documents from './20260813_100000_repair_faqs_locked_documents.ts';
import * as migration_20260814_150000_brewing_method_articles from './20260814_150000_brewing_method_articles.ts';
import * as migration_20260814_160000_global_coffee_brewing_guides from './20260814_160000_global_coffee_brewing_guides.ts';
import * as migration_20260820_090000_loyalty_program from './20260820_090000_loyalty_program.ts';
import * as migration_20260820_100000_repair_loyalty_locked_documents from './20260820_100000_repair_loyalty_locked_documents.ts';
import * as migration_20260820_110000_repair_yookassa_payment_method from './20260820_110000_repair_yookassa_payment_method.ts';
import * as migration_20260821_120000_social_identities from './20260821_120000_social_identities.ts';
import * as migration_20260821_130000_loyalty_notification_deliveries from './20260821_130000_loyalty_notification_deliveries.ts';
import * as migration_20260821_140000_yandex_delivery from './20260821_140000_yandex_delivery.ts';
import * as migration_20260821_150000_product_shipping_dimensions from './20260821_150000_product_shipping_dimensions.ts';
import * as migration_20260823_160000_social_messaging_ids from './20260823_160000_social_messaging_ids.ts';

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
  {
    up: migration_20260812_210000_paid_order_confirmation_email.up,
    down: migration_20260812_210000_paid_order_confirmation_email.down,
    name: '20260812_210000_paid_order_confirmation_email'
  },
  {
    up: migration_20260812_220000_product_review_authors.up,
    down: migration_20260812_220000_product_review_authors.down,
    name: '20260812_220000_product_review_authors'
  },
  {
    up: migration_20260813_090000_faqs.up,
    down: migration_20260813_090000_faqs.down,
    name: '20260813_090000_faqs'
  },
  {
    up: migration_20260813_100000_repair_faqs_locked_documents.up,
    down: migration_20260813_100000_repair_faqs_locked_documents.down,
    name: '20260813_100000_repair_faqs_locked_documents'
  },
  {
    up: migration_20260814_150000_brewing_method_articles.up,
    down: migration_20260814_150000_brewing_method_articles.down,
    name: '20260814_150000_brewing_method_articles'
  },
  {
    up: migration_20260814_160000_global_coffee_brewing_guides.up,
    down: migration_20260814_160000_global_coffee_brewing_guides.down,
    name: '20260814_160000_global_coffee_brewing_guides'
  },
  {
    up: migration_20260820_090000_loyalty_program.up,
    down: migration_20260820_090000_loyalty_program.down,
    name: '20260820_090000_loyalty_program'
  },
  {
    up: migration_20260820_100000_repair_loyalty_locked_documents.up,
    down: migration_20260820_100000_repair_loyalty_locked_documents.down,
    name: '20260820_100000_repair_loyalty_locked_documents'
  },
  {
    up: migration_20260820_110000_repair_yookassa_payment_method.up,
    down: migration_20260820_110000_repair_yookassa_payment_method.down,
    name: '20260820_110000_repair_yookassa_payment_method'
  },
  {
    up: migration_20260821_120000_social_identities.up,
    down: migration_20260821_120000_social_identities.down,
    name: '20260821_120000_social_identities'
  },
  {
    up: migration_20260821_130000_loyalty_notification_deliveries.up,
    down: migration_20260821_130000_loyalty_notification_deliveries.down,
    name: '20260821_130000_loyalty_notification_deliveries'
  },
  {
    up: migration_20260821_140000_yandex_delivery.up,
    down: migration_20260821_140000_yandex_delivery.down,
    name: '20260821_140000_yandex_delivery'
  },
  {
    up: migration_20260821_150000_product_shipping_dimensions.up,
    down: migration_20260821_150000_product_shipping_dimensions.down,
    name: '20260821_150000_product_shipping_dimensions'
  },
  {
    up: migration_20260823_160000_social_messaging_ids.up,
    down: migration_20260823_160000_social_messaging_ids.down,
    name: '20260823_160000_social_messaging_ids'
  },
];
