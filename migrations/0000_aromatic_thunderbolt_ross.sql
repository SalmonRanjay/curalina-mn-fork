CREATE TABLE "activity_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"action" text NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"slug" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"body" text,
	"image_url" text,
	"category" varchar DEFAULT 'general' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"author_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "design_examples" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(20) NOT NULL,
	"room_type" text NOT NULL,
	"styles" text[],
	"image_url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"reasoning" text NOT NULL,
	"design_principles" text[],
	"tags" text[],
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "design_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar NOT NULL,
	"rule" text NOT NULL,
	"description" text,
	"examples" text[],
	"counter_examples" text[],
	"priority" integer DEFAULT 1 NOT NULL,
	"applicable_rooms" text[],
	"applicable_styles" text[],
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documentation_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" varchar NOT NULL,
	"thread_root_id" varchar,
	"parent_comment_id" varchar,
	"user_id" varchar NOT NULL,
	"comment_text" text NOT NULL,
	"anchor_type" varchar(20) DEFAULT 'section' NOT NULL,
	"anchor_value" text,
	"anchor_offset" integer,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"is_internal" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"edited_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documentation_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" varchar NOT NULL,
	"content" text NOT NULL,
	"tags" text[],
	"version" integer DEFAULT 1 NOT NULL,
	"published_version" integer,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"version_notes" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"parent_section_id" varchar,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "slug_version_unique" UNIQUE("slug","version")
);
--> statement-breakpoint
CREATE TABLE "functional_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"spatial_requirements" jsonb,
	"visual_weight" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "functional_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"price_at_purchase" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"customer_email" varchar NOT NULL,
	"customer_name" text NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"stripe_payment_intent_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "placement_guidelines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_category" text NOT NULL,
	"room_type" text NOT NULL,
	"guideline" text NOT NULL,
	"do_examples" text[],
	"dont_examples" text[],
	"image_url" text,
	"priority" integer DEFAULT 1 NOT NULL,
	"reasoning" text,
	"tags" text[],
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_functional_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"functional_category_id" varchar NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "product_functional_unique" UNIQUE("product_id","functional_category_id")
);
--> statement-breakpoint
CREATE TABLE "product_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"room_type" text NOT NULL,
	"styles" text[],
	"product_skus" text[] NOT NULL,
	"image_url" text,
	"price_range" text,
	"design_notes" text,
	"tags" text[],
	"active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" varchar NOT NULL,
	"supplier_id" varchar NOT NULL,
	"trade_price" numeric(10, 2),
	"price" numeric(10, 2) NOT NULL,
	"discount" numeric(5, 2) DEFAULT '0',
	"room_type" text[],
	"design_style" text[],
	"style_tags" text[],
	"key_features" text[],
	"storage_solutions" text,
	"colors" text[],
	"materials" text[],
	"dimensions" jsonb,
	"weight" text,
	"seating" text,
	"assembly" text,
	"inventory" integer,
	"lead_time" integer,
	"availability" varchar(20) DEFAULT 'in_stock' NOT NULL,
	"shipping" jsonb,
	"images" text[],
	"asset_3d_url" text,
	"visual_description" text,
	"image_analyses" jsonb,
	"structured_analysis" jsonb,
	"visual_description_gemini" text,
	"visual_description_front_view" text,
	"visual_description_front_view_gemini" text,
	"synthesized_front_view" text,
	"complete_product_description" text,
	"structured_analysis_quality" text,
	"structured_analysis_updated_at" timestamp,
	"tags" text[],
	"source_file" text,
	"seo_meta" jsonb,
	"slug" varchar NOT NULL,
	"image_health" varchar(20) DEFAULT 'healthy' NOT NULL,
	"last_validated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "quiz_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"room_type" text NOT NULL,
	"styles" text[] NOT NULL,
	"color_palettes" text[],
	"key_features" text[],
	"budget_range" text NOT NULL,
	"vibe_images" text[],
	"vibe_board_url" text,
	"preferences" text[],
	"room_photo" text,
	"floorplan_url" text,
	"vibe_color_palette" text[],
	"vibe_materials" text[],
	"vibe_textures" text[],
	"vibe_lighting_tone" text,
	"vibe_density" text,
	"vibe_overall_description" text,
	"room_description" text,
	"parsed_room_data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "render_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"render_id" varchar NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"actor_user_id" varchar,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "render_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"render_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"sku" varchar NOT NULL,
	"name" text NOT NULL,
	"supplier_name" text,
	"category_name" text,
	"room_type" text[],
	"design_style" text[],
	"style_tags" text[],
	"price_at_render" numeric(10, 2) NOT NULL,
	"availability" varchar(20) NOT NULL,
	"image_health" varchar(20) NOT NULL,
	"visual_description_source" varchar(50),
	"dimensions" jsonb,
	"placement_data" jsonb,
	"primary_image_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "render_product_unique" UNIQUE("render_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "renders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_response_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"image_url" text,
	"prompt" text NOT NULL,
	"product_skus" text[],
	"product_placements" jsonb,
	"product_metadata" jsonb,
	"qa_results" jsonb,
	"parent_render_id" varchar,
	"swapped_sku" text,
	"status" varchar(20) DEFAULT 'generating' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "room_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"min_room_size" integer,
	"max_room_size" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "room_templates_room_type_unique" UNIQUE("room_type")
);
--> statement-breakpoint
CREATE TABLE "s3_renaming_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"total_products" integer DEFAULT 0 NOT NULL,
	"processed_products" integer DEFAULT 0 NOT NULL,
	"successful_renames" integer DEFAULT 0 NOT NULL,
	"failed_renames" integer DEFAULT 0 NOT NULL,
	"current_product_name" text,
	"error_message" text,
	"dry_run" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "s3_renaming_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"product_sku" varchar NOT NULL,
	"product_name" text NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"old_images" jsonb,
	"new_images" jsonb,
	"renamed_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "s3_job_product_unique" UNIQUE("job_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "selection_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"render_id" varchar NOT NULL,
	"selection_hash" varchar(64) NOT NULL,
	"candidate_pool_snapshot" jsonb NOT NULL,
	"selection_rationale" jsonb NOT NULL,
	"composition_order" text[] NOT NULL,
	"locked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "selection_ledger_render_id_unique" UNIQUE("render_id"),
	CONSTRAINT "selection_ledger_selection_hash_unique" UNIQUE("selection_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_category_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"functional_category_id" varchar NOT NULL,
	"min_count" integer DEFAULT 0 NOT NULL,
	"max_count" integer DEFAULT 1 NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_essential" boolean DEFAULT false NOT NULL,
	"placement_zone" text,
	"adjacency_rules" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "upload_job_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"file_hash" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"s3_url" text,
	"error_message" text,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"uploaded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "upload_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"product_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"total_files" integer DEFAULT 0 NOT NULL,
	"completed_files" integer DEFAULT 0 NOT NULL,
	"failed_files" integer DEFAULT 0 NOT NULL,
	"skipped_files" integer DEFAULT 0 NOT NULL,
	"current_file_name" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'user' NOT NULL,
	"bio" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visual_analysis_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"job_type" varchar DEFAULT 'manual' NOT NULL,
	"upload_job_id" varchar,
	"total_products" integer DEFAULT 0 NOT NULL,
	"analyzed_products" integer DEFAULT 0 NOT NULL,
	"failed_products" integer DEFAULT 0 NOT NULL,
	"skipped_products" integer DEFAULT 0 NOT NULL,
	"current_product_name" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "visual_analysis_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"product_sku" varchar NOT NULL,
	"product_name" text NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"gemini_status" varchar,
	"openai_status" varchar,
	"gemini_description" text,
	"openai_description" text,
	"error_message" text,
	"analyzed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "job_product_unique" UNIQUE("job_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "visual_description_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"mode" varchar DEFAULT 'missing_only' NOT NULL,
	"total_products" integer DEFAULT 0 NOT NULL,
	"processed_products" integer DEFAULT 0 NOT NULL,
	"successful_analyses" integer DEFAULT 0 NOT NULL,
	"failed_analyses" integer DEFAULT 0 NOT NULL,
	"skipped_products" integer DEFAULT 0 NOT NULL,
	"current_product_name" text,
	"last_checkpoint_product_id" varchar,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "visual_description_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"visual_description" text,
	"word_count" integer,
	"image_source" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "visual_desc_job_product_unique" UNIQUE("job_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_examples" ADD CONSTRAINT "design_examples_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_rules" ADD CONSTRAINT "design_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentation_comments" ADD CONSTRAINT "documentation_comments_section_id_documentation_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."documentation_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentation_comments" ADD CONSTRAINT "documentation_comments_thread_root_id_documentation_comments_id_fk" FOREIGN KEY ("thread_root_id") REFERENCES "public"."documentation_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentation_comments" ADD CONSTRAINT "documentation_comments_parent_comment_id_documentation_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."documentation_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentation_comments" ADD CONSTRAINT "documentation_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentation_comments" ADD CONSTRAINT "documentation_comments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentation_sections" ADD CONSTRAINT "documentation_sections_parent_section_id_documentation_sections_id_fk" FOREIGN KEY ("parent_section_id") REFERENCES "public"."documentation_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentation_sections" ADD CONSTRAINT "documentation_sections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentation_sections" ADD CONSTRAINT "documentation_sections_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_guidelines" ADD CONSTRAINT "placement_guidelines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_functional_categories" ADD CONSTRAINT "product_functional_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_functional_categories" ADD CONSTRAINT "product_functional_categories_functional_category_id_functional_categories_id_fk" FOREIGN KEY ("functional_category_id") REFERENCES "public"."functional_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_packages" ADD CONSTRAINT "product_packages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_events" ADD CONSTRAINT "render_events_render_id_renders_id_fk" FOREIGN KEY ("render_id") REFERENCES "public"."renders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_events" ADD CONSTRAINT "render_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_products" ADD CONSTRAINT "render_products_render_id_renders_id_fk" FOREIGN KEY ("render_id") REFERENCES "public"."renders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_products" ADD CONSTRAINT "render_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renders" ADD CONSTRAINT "renders_quiz_response_id_quiz_responses_id_fk" FOREIGN KEY ("quiz_response_id") REFERENCES "public"."quiz_responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "s3_renaming_jobs" ADD CONSTRAINT "s3_renaming_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "s3_renaming_products" ADD CONSTRAINT "s3_renaming_products_job_id_s3_renaming_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."s3_renaming_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "s3_renaming_products" ADD CONSTRAINT "s3_renaming_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_ledger" ADD CONSTRAINT "selection_ledger_render_id_renders_id_fk" FOREIGN KEY ("render_id") REFERENCES "public"."renders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_category_rules" ADD CONSTRAINT "template_category_rules_template_id_room_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."room_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_category_rules" ADD CONSTRAINT "template_category_rules_functional_category_id_functional_categories_id_fk" FOREIGN KEY ("functional_category_id") REFERENCES "public"."functional_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_job_files" ADD CONSTRAINT "upload_job_files_job_id_upload_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."upload_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_jobs" ADD CONSTRAINT "upload_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_jobs" ADD CONSTRAINT "upload_jobs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_analysis_jobs" ADD CONSTRAINT "visual_analysis_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_analysis_jobs" ADD CONSTRAINT "visual_analysis_jobs_upload_job_id_upload_jobs_id_fk" FOREIGN KEY ("upload_job_id") REFERENCES "public"."upload_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_analysis_products" ADD CONSTRAINT "visual_analysis_products_job_id_visual_analysis_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."visual_analysis_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_analysis_products" ADD CONSTRAINT "visual_analysis_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_description_jobs" ADD CONSTRAINT "visual_description_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_description_products" ADD CONSTRAINT "visual_description_products_job_id_visual_description_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."visual_description_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_description_products" ADD CONSTRAINT "visual_description_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_comments_section" ON "documentation_comments" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_comments_thread" ON "documentation_comments" USING btree ("thread_root_id");--> statement-breakpoint
CREATE INDEX "idx_comments_parent" ON "documentation_comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "idx_comments_anchor" ON "documentation_comments" USING btree ("anchor_value");--> statement-breakpoint
CREATE INDEX "idx_docs_status" ON "documentation_sections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_docs_slug" ON "documentation_sections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_render_events_render_time" ON "render_events" USING btree ("render_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_render_events_type" ON "render_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_render_products_render" ON "render_products" USING btree ("render_id");--> statement-breakpoint
CREATE INDEX "idx_render_products_product" ON "render_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_render_products_sku" ON "render_products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_s3_job_status" ON "s3_renaming_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_s3_product_job_status" ON "s3_renaming_products" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "idx_s3_product_id" ON "s3_renaming_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_file_job_status" ON "upload_job_files" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "idx_job_product_status" ON "upload_jobs" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "idx_job_status" ON "upload_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_analysis_job_status" ON "visual_analysis_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_analysis_job_upload" ON "visual_analysis_jobs" USING btree ("upload_job_id");--> statement-breakpoint
CREATE INDEX "idx_analysis_product_job_status" ON "visual_analysis_products" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "idx_analysis_product_id" ON "visual_analysis_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_visual_desc_job_status" ON "visual_description_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_visual_desc_product_job_status" ON "visual_description_products" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "idx_visual_desc_product_id" ON "visual_description_products" USING btree ("product_id");