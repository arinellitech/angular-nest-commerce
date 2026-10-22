CREATE TABLE "cart_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cart_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cart_id" uuid NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_quantity_positive" CHECK ("cart_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer,
	"token" varchar(64) NOT NULL,
	"coupon_id" integer,
	"currency" char(3) DEFAULT 'BRL' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"parent_id" integer,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"type" varchar(16) NOT NULL,
	"value" integer NOT NULL,
	"min_subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_quantity_nonnegative" CHECK ("inventory"."quantity" >= 0),
	CONSTRAINT "inventory_reserved_range" CHECK ("inventory"."reserved" >= 0 AND "inventory"."reserved" <= "inventory"."quantity")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" uuid NOT NULL,
	"product_id" integer,
	"name" varchar(255) NOT NULL,
	"sku" varchar(64) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"total_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" varchar(32) NOT NULL,
	"user_id" integer,
	"cart_id" uuid,
	"coupon_id" integer,
	"status" varchar(32) DEFAULT 'pending_payment' NOT NULL,
	"currency" char(3) DEFAULT 'BRL' NOT NULL,
	"customer" jsonb NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"subtotal_cents" bigint NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"shipping_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint NOT NULL,
	"idempotency_key" varchar(128),
	"placed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"method" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"provider_reference" varchar(255),
	"pix_qr_code" text,
	"pix_copy_paste" text,
	"expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"disk" varchar(32) DEFAULT 'public' NOT NULL,
	"path" text NOT NULL,
	"alt" varchar(255),
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category_id" integer,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"sku" varchar(64) NOT NULL,
	"description" text,
	"price_cents" bigint NOT NULL,
	"compare_at_price_cents" bigint,
	"currency" char(3) DEFAULT 'BRL' NOT NULL,
	"specs" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_cents_nonnegative" CHECK ("products"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"quantity" integer NOT NULL,
	"reference_type" varchar(64),
	"reference_id" varchar(64),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" varchar(32) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"type" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_cart_product_unique" ON "cart_items" USING btree ("cart_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_token_unique" ON "carts" USING btree ("token");--> statement-breakpoint
CREATE INDEX "carts_status_expires_idx" ON "carts" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_active_position_idx" ON "categories" USING btree ("is_active","position");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_unique" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_unique" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key_unique" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_status_placed_idx" ON "orders" USING btree ("status","placed_at");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_provider_reference_idx" ON "payments" USING btree ("provider_reference");--> statement-breakpoint
CREATE INDEX "payments_order_status_idx" ON "payments" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "product_images_product_position_idx" ON "product_images" USING btree ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_unique" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_unique" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_active_published_idx" ON "products" USING btree ("is_active","published_at");--> statement-breakpoint
CREATE INDEX "products_price_idx" ON "products" USING btree ("price_cents");--> statement-breakpoint
CREATE INDEX "stock_movements_reference_idx" ON "stock_movements" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "stock_movements_product_created_idx" ON "stock_movements" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_external_unique" ON "webhook_events" USING btree ("provider","external_id");