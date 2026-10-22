/**
 * Drizzle schema — the single source of truth for the database.
 * Migrations are generated from this file with `npm run db:generate`
 * (drizzle-kit) and applied with `npm run db:migrate`.
 *
 * Conventions:
 * - Money is integer cents (bigint mode: 'number'); never numeric/float.
 * - Public identifiers (carts, orders, payments) are UUIDs; catalog uses integers.
 * - Status columns are plain text validated by the TS unions in src/**.
 */
import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const categories = pgTable(
  'categories',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    parentId: integer('parent_id'),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    position: integer('position').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('categories_slug_unique').on(t.slug),
    index('categories_active_position_idx').on(t.isActive, t.position),
  ],
);

export const products = pgTable(
  'products',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    sku: varchar('sku', { length: 64 }).notNull(),
    description: text('description'),
    priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
    compareAtPriceCents: bigint('compare_at_price_cents', { mode: 'number' }),
    currency: char('currency', { length: 3 }).default('BRL').notNull(),
    specs: jsonb('specs').$type<Record<string, string>>(),
    isActive: boolean('is_active').default(true).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('products_slug_unique').on(t.slug),
    uniqueIndex('products_sku_unique').on(t.sku),
    index('products_active_published_idx').on(t.isActive, t.publishedAt),
    index('products_price_idx').on(t.priceCents),
    check('products_price_cents_nonnegative', sql`${t.priceCents} >= 0`),
  ],
);

export const productImages = pgTable(
  'product_images',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    disk: varchar('disk', { length: 32 }).default('public').notNull(),
    path: text('path').notNull(),
    alt: varchar('alt', { length: 255 }),
    position: integer('position').default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    index('product_images_product_position_idx').on(t.productId, t.position),
  ],
);

/**
 * One row per product. `reserved` grows when an order is placed and is
 * consumed/released when the payment confirms/fails.
 * Invariant enforced by the database: 0 <= reserved <= quantity.
 */
export const inventory = pgTable(
  'inventory',
  {
    productId: integer('product_id')
      .primaryKey()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').default(0).notNull(),
    reserved: integer('reserved').default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    check('inventory_quantity_nonnegative', sql`${t.quantity} >= 0`),
    check(
      'inventory_reserved_range',
      sql`${t.reserved} >= 0 AND ${t.reserved} <= ${t.quantity}`,
    ),
  ],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 32 }).notNull(), // received | reserved | released | sold | adjusted
    quantity: integer('quantity').notNull(), // signed
    referenceType: varchar('reference_type', { length: 64 }), // e.g. "order"
    referenceId: varchar('reference_id', { length: 64 }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('stock_movements_reference_idx').on(t.referenceType, t.referenceId),
    index('stock_movements_product_created_idx').on(t.productId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export const coupons = pgTable(
  'coupons',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    code: varchar('code', { length: 64 }).notNull(),
    type: varchar('type', { length: 16 }).notNull(), // percent | fixed
    value: integer('value').notNull(), // percent (0-100) or cents
    minSubtotalCents: bigint('min_subtotal_cents', { mode: 'number' })
      .default(0)
      .notNull(),
    maxUses: integer('max_uses'),
    uses: integer('uses').default(0).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('coupons_code_unique').on(t.code)],
);

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // Opaque token handed to guests via the X-Cart-Token header.
    token: varchar('token', { length: 64 }).notNull(),
    couponId: integer('coupon_id').references(() => coupons.id, {
      onDelete: 'set null',
    }),
    currency: char('currency', { length: 3 }).default('BRL').notNull(),
    status: varchar('status', { length: 16 }).default('active').notNull(), // active | converted | abandoned
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('carts_token_unique').on(t.token),
    index('carts_status_expires_idx').on(t.status, t.expiresAt),
  ],
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    // Price snapshot when added; re-validated at checkout.
    unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('cart_items_cart_product_unique').on(t.cartId, t.productId),
    check('cart_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Orders & payments
// ---------------------------------------------------------------------------

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: varchar('number', { length: 32 }).notNull(), // ORD-2026-000001
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    cartId: uuid('cart_id').references(() => carts.id, {
      onDelete: 'set null',
    }),
    couponId: integer('coupon_id').references(() => coupons.id, {
      onDelete: 'set null',
    }),
    // pending_payment | paid | fulfilled | cancelled | refunded
    status: varchar('status', { length: 32 })
      .default('pending_payment')
      .notNull(),
    currency: char('currency', { length: 3 }).default('BRL').notNull(),
    customer: jsonb('customer').$type<OrderCustomer>().notNull(),
    shippingAddress: jsonb('shipping_address').$type<OrderAddress>().notNull(),
    subtotalCents: bigint('subtotal_cents', { mode: 'number' }).notNull(),
    discountCents: bigint('discount_cents', { mode: 'number' })
      .default(0)
      .notNull(),
    shippingCents: bigint('shipping_cents', { mode: 'number' })
      .default(0)
      .notNull(),
    totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
    // Client-supplied Idempotency-Key: same key always returns the same order.
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    placedAt: timestamp('placed_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('orders_number_unique').on(t.number),
    uniqueIndex('orders_idempotency_key_unique').on(t.idempotencyKey),
    index('orders_status_placed_idx').on(t.status, t.placedAt),
    index('orders_user_idx').on(t.userId),
  ],
);

export const orderItems = pgTable('order_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, {
    onDelete: 'set null',
  }),
  // Snapshots: an order must survive product edits/deletions.
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 64 }).notNull(),
  quantity: integer('quantity').notNull(),
  unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull(),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
  ...timestamps,
});

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(), // mock | asaas | pagarme | stripe
    method: varchar('method', { length: 16 }).notNull(), // pix | card | boleto
    status: varchar('status', { length: 16 }).default('pending').notNull(), // pending | confirmed | failed | refunded | expired
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    providerReference: varchar('provider_reference', { length: 255 }),
    pixQrCode: text('pix_qr_code'), // base64 image or payload URL
    pixCopyPaste: text('pix_copy_paste'), // EMV "copia e cola"
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    index('payments_provider_reference_idx').on(t.providerReference),
    index('payments_order_status_idx').on(t.orderId, t.status),
  ],
);

/**
 * Every inbound webhook is stored before processing. (provider, external_id)
 * is unique so a redelivered event is a no-op (idempotent consumer).
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: varchar('provider', { length: 32 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    type: varchar('type', { length: 64 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('webhook_events_provider_external_unique').on(
      t.provider,
      t.externalId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// JSON column shapes
// ---------------------------------------------------------------------------

export interface OrderCustomer {
  name: string;
  email: string;
  document: string; // CPF/CNPJ
  phone?: string;
}

export interface OrderAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// ---------------------------------------------------------------------------
// Relations (for db.query.*)
// ---------------------------------------------------------------------------

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'tree',
  }),
  children: many(categories, { relationName: 'tree' }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  images: many(productImages),
  inventory: one(inventory, {
    fields: [products.id],
    references: [inventory.productId],
  }),
  stockMovements: many(stockMovements),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  coupon: one(coupons, { fields: [carts.couponId], references: [coupons.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  cart: one(carts, { fields: [orders.cartId], references: [carts.id] }),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
  items: many(orderItems),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  carts: many(carts),
}));

// Row types
export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
