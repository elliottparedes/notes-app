export interface UserInvitation {
  id: number;
  owner_id: number;
  invited_email: string;
  invited_user_id: number | null;
  status: 'pending' | 'accepted';
  created_at: Date;
}

export interface UserInvitationWithUser extends UserInvitation {
  name?: string;
  email?: string;
}
