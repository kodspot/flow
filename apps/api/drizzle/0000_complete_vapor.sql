CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata` text,
	`ip` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_workspace_idx` ON `audit_logs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`company` text,
	`email` text,
	`phone` text,
	`whatsapp_phone` text,
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`country` text DEFAULT 'India' NOT NULL,
	`gst_number` text,
	`notes` text,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clients_workspace_idx` ON `clients` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `clients_name_idx` ON `clients` (`workspace_id`,`name`);--> statement-breakpoint
CREATE TABLE `company_profiles` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`brand_name` text NOT NULL,
	`tagline` text,
	`email` text,
	`phone` text,
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`country` text DEFAULT 'India' NOT NULL,
	`gst_number` text,
	`pan_number` text,
	`udyam_number` text,
	`bank_account_name` text,
	`bank_name` text,
	`bank_branch` text,
	`bank_ifsc` text,
	`bank_account_number` text,
	`upi_id` text,
	`upi_qr_r2_key` text,
	`logo_r2_key` text,
	`signature_r2_key` text,
	`signatory_name` text,
	`signatory_designation` text,
	`invoice_number_prefix` text DEFAULT 'KOD/INV' NOT NULL,
	`default_place_of_supply` text,
	`default_gst_note` text,
	`default_invoice_notes` text,
	`default_due_days` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`invoice_id` text,
	`channel` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text,
	`status` text NOT NULL,
	`provider_message_id` text,
	`error` text,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `deliveries_invoice_idx` ON `deliveries` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `deliveries_workspace_idx` ON `deliveries` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`description` text NOT NULL,
	`period` text,
	`rate_label` text,
	`rate_paise` integer,
	`days` integer,
	`quantity` integer DEFAULT 1 NOT NULL,
	`amount_paise` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invoice_items_invoice_idx` ON `invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`client_id` text NOT NULL,
	`client_snapshot` text NOT NULL,
	`invoice_number` text NOT NULL,
	`sequence_year` integer NOT NULL,
	`sequence_number` integer NOT NULL,
	`invoice_date` integer NOT NULL,
	`due_date` integer,
	`place_of_supply` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`subtotal_paise` integer DEFAULT 0 NOT NULL,
	`gst_applicable` integer DEFAULT false NOT NULL,
	`gst_rate_percent` integer DEFAULT 0 NOT NULL,
	`gst_amount_paise` integer DEFAULT 0 NOT NULL,
	`gst_note` text,
	`total_paise` integer DEFAULT 0 NOT NULL,
	`paid_paise` integer DEFAULT 0 NOT NULL,
	`amount_in_words` text DEFAULT '' NOT NULL,
	`notes` text,
	`internal_notes` text,
	`pdf_r2_key` text,
	`html_snapshot_r2_key` text,
	`locked_at` integer,
	`sent_at` integer,
	`paid_at` integer,
	`recurring_profile_id` text,
	`recurring_period_key` text,
	`idempotency_key` text,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invoices_workspace_idx` ON `invoices` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `invoices_client_idx` ON `invoices` (`client_id`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`workspace_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_workspace_number_uq` ON `invoices` (`workspace_id`,`invoice_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_workspace_seq_uq` ON `invoices` (`workspace_id`,`sequence_year`,`sequence_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_workspace_idem_uq` ON `invoices` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_recurring_period_uq` ON `invoices` (`recurring_profile_id`,`recurring_period_key`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`paid_at` integer NOT NULL,
	`method` text DEFAULT 'bank_transfer' NOT NULL,
	`reference` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payments_workspace_idx` ON `payments` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `recurring_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`amount_paise` integer NOT NULL,
	`rate_label` text,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`day_of_month` integer DEFAULT 1 NOT NULL,
	`next_run_at` integer NOT NULL,
	`last_run_at` integer,
	`auto_send_email` integer DEFAULT false NOT NULL,
	`auto_send_whatsapp` integer DEFAULT false NOT NULL,
	`gst_applicable` integer DEFAULT false NOT NULL,
	`gst_rate_percent` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recurring_workspace_idx` ON `recurring_profiles` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `recurring_next_run_idx` ON `recurring_profiles` (`active`,`next_run_at`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`channel` text NOT NULL,
	`kind` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`sent_at` integer,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminders_scheduled_idx` ON `reminders` (`scheduled_at`,`sent_at`);--> statement-breakpoint
CREATE INDEX `reminders_invoice_idx` ON `reminders` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`email_verified_at` integer,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_workspace_idx` ON `users` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unique` ON `workspaces` (`slug`);