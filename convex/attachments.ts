import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// --- For Client-side Uploads (via Upload URL) ---

// 1. Generate a temporary URL for the client to upload a file to.
// This is a secure way to let clients upload files without them hitting your server function.
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to upload a file.");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// 2. Save the metadata of the uploaded file.
// The client calls this after successfully uploading the file to the URL from generateUploadUrl.
export const saveAttachment = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    conversationId: v.optional(v.id("conversations")),
  },
  returns: v.id("attachments"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const attachmentId = await ctx.db.insert("attachments", {
      userId: identity.subject,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
      createdAt: Date.now(),
      conversationId: args.conversationId,
    });

    return attachmentId;
  },
});

// NEW: An internal mutation to update token counts for a batch of attachments
export const updateTokenCountForAttachments = internalMutation({
  args: {
    attachmentIds: v.array(v.id("attachments")),
    promptTokens: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { attachmentIds, promptTokens }) => {
    for (const attachmentId of attachmentIds) {
      await ctx.db.patch(attachmentId, { promptTokens });
    }
    return null;
  },
});

// NEW: Query to get all attachments for a specific conversation
export const getAttachmentsForConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("attachments"),
      _creationTime: v.number(),
      userId: v.string(),
      storageId: v.id("_storage"),
      fileName: v.string(),
      contentType: v.string(),
      createdAt: v.number(),
      conversationId: v.optional(v.id("conversations")),
      promptTokens: v.optional(v.number()),
      url: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Verify user has access to this conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      return [];
    }

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .collect();

    return Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        url: await ctx.storage.getUrl(attachment.storageId),
      }))
    );
  },
});

// --- For Attachment Management Page ---

// Get all attachments for the currently logged-in user.
export const getAttachmentsForUser = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("attachments"),
      _creationTime: v.number(),
      userId: v.string(),
      storageId: v.id("_storage"),
      fileName: v.string(),
      contentType: v.string(),
      createdAt: v.number(),
      conversationId: v.optional(v.id("conversations")),
      promptTokens: v.optional(v.number()),
      url: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    // Include the URL for each attachment
    return Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        url: await ctx.storage.getUrl(attachment.storageId),
      }))
    );
  },
});

// Delete an attachment from storage and the database.
export const deleteAttachment = mutation({
  args: {
    attachmentId: v.id("attachments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new Error("Attachment not found");
    }

    // Check ownership
    if (attachment.userId !== identity.subject) {
      throw new Error("Not authorised to delete this attachment");
    }

    // Delete the file from Convex storage
    await ctx.storage.delete(attachment.storageId);
    // Delete the metadata from the database
    await ctx.db.delete(args.attachmentId);

    return null;
  },
});

// Get a specific attachment by ID (useful for checking ownership)
export const getAttachment = query({
  args: {
    attachmentId: v.id("attachments"),
  },
  returns: v.union(
    v.object({
      _id: v.id("attachments"),
      _creationTime: v.number(),
      userId: v.string(),
      storageId: v.id("_storage"),
      fileName: v.string(),
      contentType: v.string(),
      createdAt: v.number(),
      conversationId: v.optional(v.id("conversations")),
      promptTokens: v.optional(v.number()),
      url: v.union(v.string(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment || attachment.userId !== identity.subject) {
      return null;
    }

    return {
      ...attachment,
      url: await ctx.storage.getUrl(attachment.storageId),
    };
  },
}); 