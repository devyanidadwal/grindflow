import { relations } from "drizzle-orm/relations";
import { userProfiles, chatrooms, chatroomMembers, chatMessages, notifications, documents, documentsText, documentsMetadata, publicLibrary } from "./schema";

export const chatroomsRelations = relations(chatrooms, ({one, many}) => ({
	userProfile: one(userProfiles, {
		fields: [chatrooms.createdBy],
		references: [userProfiles.id]
	}),
	chatroomMembers: many(chatroomMembers),
}));

export const userProfilesRelations = relations(userProfiles, ({many}) => ({
	chatrooms: many(chatrooms),
	chatroomMembers: many(chatroomMembers),
	chatMessages: many(chatMessages),
	notifications: many(notifications),
	documents: many(documents),
	publicLibraries: many(publicLibrary),
}));

export const chatroomMembersRelations = relations(chatroomMembers, ({one}) => ({
	chatroom: one(chatrooms, {
		fields: [chatroomMembers.chatroomId],
		references: [chatrooms.id]
	}),
	userProfile: one(userProfiles, {
		fields: [chatroomMembers.userId],
		references: [userProfiles.id]
	}),
}));

export const chatMessagesRelations = relations(chatMessages, ({one}) => ({
	userProfile: one(userProfiles, {
		fields: [chatMessages.userId],
		references: [userProfiles.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	userProfile: one(userProfiles, {
		fields: [notifications.userId],
		references: [userProfiles.id]
	}),
}));

export const documentsRelations = relations(documents, ({one, many}) => ({
	userProfile: one(userProfiles, {
		fields: [documents.userId],
		references: [userProfiles.id]
	}),
	documentsTexts: many(documentsText),
	documentsMetadata: many(documentsMetadata),
	publicLibraries: many(publicLibrary),
}));

export const documentsTextRelations = relations(documentsText, ({one}) => ({
	document: one(documents, {
		fields: [documentsText.documentId],
		references: [documents.id]
	}),
}));

export const documentsMetadataRelations = relations(documentsMetadata, ({one}) => ({
	document: one(documents, {
		fields: [documentsMetadata.documentId],
		references: [documents.id]
	}),
}));

export const publicLibraryRelations = relations(publicLibrary, ({one}) => ({
	document: one(documents, {
		fields: [publicLibrary.documentId],
		references: [documents.id]
	}),
	userProfile: one(userProfiles, {
		fields: [publicLibrary.uploadedBy],
		references: [userProfiles.id]
	}),
}));