import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const updateTitle = internalMutation({
    args: {
        conversationId: v.id("conversations"),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.conversationId, { title: args.title });
    },
}); 