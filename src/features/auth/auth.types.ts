export interface OAuthProfile {
	id: string;
	displayName: string;
	email?: string;
	avatar?: string;
	provider: 'google';
	providerUserId?: string;
	user_metadata?: any;
	identities?: Array<{ provider: string; provider_id: string }>;
}
