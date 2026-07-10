// Moderation lifecycle for user-submitted content.
// User submissions start as PENDING and must be validated by an admin.
export enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}
