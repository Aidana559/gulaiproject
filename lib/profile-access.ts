

export const PROFILE_ROLE = "user";


export const canViewPublicProfiles = (role: string | null | undefined): boolean => role === PROFILE_ROLE || role === "admin" || role === "moderator";


export const hasPublicProfile = (u: { role?: string | null; blocked?: boolean } | null | undefined): boolean =>
  !!u && u.role === PROFILE_ROLE && !u.blocked;
