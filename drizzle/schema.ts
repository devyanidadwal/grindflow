import { pgTable, index, unique, text, timestamp, foreignKey, uuid, boolean, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const userProfiles = pgTable("user_profiles", {
	id: text().primaryKey().notNull(),
	username: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_profiles_username").using("btree", table.username.asc().nullsLast().op("text_ops")),
	unique("user_profiles_username_key").on(table.username),
]);

export const chatrooms = pgTable("chatrooms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	isPrivate: boolean("is_private").default(false),
	createdBy: text("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_chatrooms_created_by").using("btree", table.createdBy.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [userProfiles.id],
			name: "chatrooms_created_by_fkey"
		}).onDelete("cascade"),
]);

export const chatroomMembers = pgTable("chatroom_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatroomId: uuid("chatroom_id").notNull(),
	userId: text("user_id").notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_chatroom_members_chatroom").using("btree", table.chatroomId.asc().nullsLast().op("uuid_ops")),
	index("idx_chatroom_members_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.chatroomId],
			foreignColumns: [chatrooms.id],
			name: "chatroom_members_chatroom_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "chatroom_members_user_id_fkey"
		}).onDelete("cascade"),
	unique("chatroom_members_chatroom_id_user_id_key").on(table.chatroomId, table.userId),
]);

export const chatMessages = pgTable("chat_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatroomId: text("chatroom_id").notNull(),
	userId: text("user_id").notNull(),
	userEmail: text("user_email").notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_chat_messages_chatroom").using("btree", table.chatroomId.asc().nullsLast().op("text_ops")),
	index("idx_chat_messages_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "chat_messages_user_id_fkey"
		}).onDelete("cascade"),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	type: text().default('mention').notNull(),
	title: text().notNull(),
	message: text().notNull(),
	relatedMessageId: uuid("related_message_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	read: boolean().default(false),
}, (table) => [
	index("idx_notifications_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_notifications_read").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.read.asc().nullsLast().op("text_ops")),
	index("idx_notifications_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "notifications_user_id_fkey"
		}).onDelete("cascade"),
]);

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	fileName: text("file_name").notNull(),
	storagePath: text("storage_path").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_documents_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("idx_documents_user_created").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "documents_user_id_fkey"
		}).onDelete("cascade"),
]);

export const documentsText = pgTable("documents_text", {
	documentId: uuid("document_id").primaryKey().notNull(),
	text: text(),
	normalizedText: text("normalized_text"),
	shortText: text("short_text"),
	extractedAt: timestamp("extracted_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "documents_text_document_id_fkey"
		}).onDelete("cascade"),
]);

export const documentsMetadata = pgTable("documents_metadata", {
	documentId: uuid("document_id").primaryKey().notNull(),
	aiRating: integer("ai_rating"),
	aiCritique: text("ai_critique"),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "documents_metadata_document_id_fkey"
		}).onDelete("cascade"),
]);

export const publicLibrary = pgTable("public_library", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	subject: text().notNull(),
	unit: text(),
	year: text(),
	degree: text(),
	score: integer(),
	analysisKeyword: text("analysis_keyword"),
	verdict: text(),
	rationale: text(),
	focusTopics: text("focus_topics"),
	repetitiveTopics: text("repetitive_topics"),
	suggestedPlan: text("suggested_plan"),
	uploadedBy: text("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_public_library_document").using("btree", table.documentId.asc().nullsLast().op("uuid_ops")),
	index("idx_public_library_uploaded_at").using("btree", table.uploadedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "public_library_document_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [userProfiles.id],
			name: "public_library_uploaded_by_fkey"
		}).onDelete("cascade"),
	unique("public_library_document_id_key").on(table.documentId),
]);
