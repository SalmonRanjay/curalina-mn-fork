CREATE TABLE "product_interactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_id" varchar,
	"product_id" varchar NOT NULL,
	"interaction_type" varchar(30) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_designs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"render_id" varchar NOT NULL,
	"title" text,
	"notes" text,
	"share_token" varchar,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "saved_designs_share_token_unique" UNIQUE("share_token"),
	CONSTRAINT "user_render_unique" UNIQUE("user_id","render_id")
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "user_id" varchar;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "user_id" varchar;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" varchar;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_carrier" varchar;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "estimated_delivery" timestamp;--> statement-breakpoint
ALTER TABLE "quiz_responses" ADD COLUMN "user_id" varchar;--> statement-breakpoint
ALTER TABLE "quiz_responses" ADD COLUMN "line_style" text;--> statement-breakpoint
ALTER TABLE "quiz_responses" ADD COLUMN "textures" text[];--> statement-breakpoint
ALTER TABLE "quiz_responses" ADD COLUMN "lifestyle_cue" text;--> statement-breakpoint
ALTER TABLE "quiz_responses" ADD COLUMN "pattern_preference" text;--> statement-breakpoint
ALTER TABLE "renders" ADD COLUMN "user_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number" varchar;--> statement-breakpoint
ALTER TABLE "product_interactions" ADD CONSTRAINT "product_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_interactions" ADD CONSTRAINT "product_interactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_designs" ADD CONSTRAINT "saved_designs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_designs" ADD CONSTRAINT "saved_designs_render_id_renders_id_fk" FOREIGN KEY ("render_id") REFERENCES "public"."renders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_interactions_user" ON "product_interactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_product_interactions_product" ON "product_interactions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_interactions_type" ON "product_interactions" USING btree ("interaction_type");--> statement-breakpoint
CREATE INDEX "idx_saved_designs_user" ON "saved_designs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_saved_designs_share" ON "saved_designs" USING btree ("share_token");--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_responses" ADD CONSTRAINT "quiz_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renders" ADD CONSTRAINT "renders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;