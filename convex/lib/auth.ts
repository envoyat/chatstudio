import { QueryCtx, MutationCtx } from "../_generated/server";

export async function getCurrentUserQuery(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Check if we already have a user for this identity
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  return user;
}

export async function getCurrentUserMutation(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Check if we already have a user for this identity
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (user) {
    return user;
  }

  // Create a new user if this is their first time
  const userId = await ctx.db.insert("users", {
    name: identity.name,
    email: identity.email,
    image: identity.pictureUrl,
    tokenIdentifier: identity.tokenIdentifier,
  });

  return await ctx.db.get(userId);
}

export async function requireUserQuery(ctx: QueryCtx) {
  const user = await getCurrentUserQuery(ctx);
  if (!user) {
    throw new Error("User must be authenticated");
  }
  return user;
}

export async function requireUserMutation(ctx: MutationCtx) {
  const user = await getCurrentUserMutation(ctx);
  if (!user) {
    throw new Error("User must be authenticated");
  }
  return user;
} 