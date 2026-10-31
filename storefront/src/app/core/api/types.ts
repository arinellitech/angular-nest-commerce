/**
 * Contract between the storefront and the API (api/docs/api.md).
 * Keep in sync with api/src/catalog/catalog.mappers.ts. Money is integer cents.
 */

export interface Money {
  amount: number;
  currency: string;
  formatted: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  products_count?: number;
  children?: Category[];
}

export interface ProductImage {
  id: number;
  url: string;
  alt: string | null;
  position: number;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  price: Money;
  compare_at_price?: Money;
  specs: Record<string, string>;
  in_stock: boolean | null;
  available_quantity: number | null;
  category?: Category;
  images?: ProductImage[];
  published_at: string | null;
}

/** API default: `relevance` with `search`, `newest` otherwise. */
export type ProductSort = 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'name';

/**
 * `meta.facets` of GET /products, only present with `search`. Disjunctive:
 * category counts ignore the category filter, the price range ignores the
 * price filter.
 */
export interface ProductFacets {
  categories: { slug: string; name: string; count: number }[];
  price: { min: Money; max: Money } | null;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  sort?: ProductSort;
  page?: number;
  per_page?: number;
}

// Cart (PROMPT 02) / checkout / orders (PROMPTS 03-05).

export interface CartItem {
  id: number;
  /** `images` holds at most the first image. */
  product: Pick<Product, 'id' | 'name' | 'slug' | 'images'>;
  quantity: number;
  /** Price snapshot from when the line was added/changed; checkout re-validates it. */
  unit_price: Money;
  total: Money;
  /** Units still purchasable right now; 0 when the product left the catalog. */
  available_quantity: number;
}

export interface Cart {
  id: string;
  token: string;
  currency: string;
  status: 'active' | 'converted' | 'abandoned';
  items: CartItem[];
  coupon: { code: string; discount: Money } | null;
  subtotal: Money;
  discount: Money;
  shipping: Money;
  total: Money;
  expires_at: string | null;
}

export type OrderStatus = 'pending_payment' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded';
export type PaymentMethod = 'pix' | 'card' | 'boleto';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded' | 'expired';

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface Customer {
  name: string;
  email: string;
  document: string; // CPF/CNPJ
  phone?: string;
}

export interface Payment {
  id: string;
  provider: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: Money;
  pix_copy_paste: string | null;
  pix_qr_code: string | null;
  expires_at: string | null;
}

export interface OrderItem {
  id: number;
  name: string;
  sku: string;
  quantity: number;
  unit_price: Money;
  total: Money;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  customer: Customer;
  shipping_address: Address;
  items: OrderItem[];
  subtotal: Money;
  discount: Money;
  shipping: Money;
  total: Money;
  payment: Payment | null;
  placed_at: string;
  paid_at: string | null;
}

export interface CheckoutPayload {
  customer: Customer;
  shipping_address: Address;
  payment_method: PaymentMethod;
}

// Envelopes

export interface PaginationMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: PaginationMeta;
}

/** GET /products */
export type ProductPage = Paginated<Product> & { meta: { facets?: ProductFacets } };

export interface Single<T> {
  data: T;
}

export interface ApiValidationError {
  message: string;
  errors: Record<string, string[]>;
}
