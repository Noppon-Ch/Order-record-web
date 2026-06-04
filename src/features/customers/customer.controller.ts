import type { Request, Response } from 'express';
import crypto from 'crypto';
import { customerService } from './customer.service.js';
import { teamService } from '../teams/services/team.service.js';
import type { CreateCustomerDTO } from './customer.types.js';

async function getGoogleAccessToken(): Promise<string> {
	const email = process.env.GOOGLE_VISION_CLIENT_EMAIL;
	const privateKey = process.env.GOOGLE_VISION_PRIVATE_KEY?.replace(/\\n/g, '\n');

	if (!email || !privateKey) {
		throw new Error('Missing Google Vision credentials in environment variables');
	}

	const base64UrlEncode = (str: string) => {
		return Buffer.from(str)
			.toString('base64')
			.replace(/=/g, '')
			.replace(/\+/g, '-')
			.replace(/\//g, '_');
	};

	const header = { alg: 'RS256', typ: 'JWT' };
	const claimSet = {
		iss: email,
		scope: 'https://www.googleapis.com/auth/cloud-platform',
		aud: 'https://oauth2.googleapis.com/token',
		exp: Math.floor(Date.now() / 1000) + 3600,
		iat: Math.floor(Date.now() / 1000)
	};

	const jwtHeader = base64UrlEncode(JSON.stringify(header));
	const jwtClaimSet = base64UrlEncode(JSON.stringify(claimSet));
	const signatureInput = `${jwtHeader}.${jwtClaimSet}`;

	const sign = crypto.createSign('RSA-SHA256');
	sign.update(signatureInput);
	const signature = sign.sign(privateKey, 'base64');
	const jwtSignature = signature
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');

	const assertion = `${signatureInput}.${jwtSignature}`;

	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: assertion
		})
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`Failed to authenticate with Google: ${errText}`);
	}

	const data = await response.json();
	return data.access_token;
}

function sanitizeDateToCE(dateStr?: string): string | undefined {
	if (!dateStr) return undefined;
	const parts = dateStr.split('-');
	if (parts.length === 3) {
		const firstPart = parts[0];
		if (firstPart) {
			const year = parseInt(firstPart);
			if (year > 2400) {
				parts[0] = String(year - 543);
				return parts.join('-');
			}
		}
	}
	return dateStr;
}

export class CustomerController {
	async showAddForm(req: Request, res: Response) {
		const user = req.user;
		res.render('add-new-customer', { user, error: null, values: {}, nonce: res.locals.nonce });
	}

	async showAddOldCustomerForm(req: Request, res: Response) {
		const user = req.user;
		res.render('add-old-customer', { user, error: null, values: {}, nonce: res.locals.nonce });
	}

	async addCustomer(req: Request, res: Response) {
		// Log user and accessToken for debugging
		// console.log('req.user:', req.user);
		// console.log('req.user.access_token:', req.user?.access_token);
		// Map form fields to DB fields, allow zipcode and consent to be null
		const body = req.body;
		const values: CreateCustomerDTO = {
			customer_citizen_id: body.customer_citizen_id,
			customer_fname_th: body.customer_fname_th,
			customer_lname_th: body.customer_lname_th,
			customer_fname_en: body.customer_fname_en || undefined,
			customer_lname_en: body.customer_lname_en || undefined,
			customer_gender: body.customer_gender,
			customer_nationality: body.customer_nationality,
			customer_tax_id: body.customer_tax_id || undefined,
			customer_phone: body.customer_phone,
			customer_birthdate: sanitizeDateToCE(body.customer_birthdate),
			customer_registerdate: sanitizeDateToCE(body.customer_reg_date),
			customer_address1: body.customer_address1,
			customer_address2: body.customer_address2,
			customer_zipcode: body.customer_zipcode || undefined,
			customer_position: body.customer_position,
			customer_consent_status: body.customer_consent === 'on',
			customer_recommender_id: body.referrer_citizen_id || '',
			customer_record_by_user_id: req.user?.id || '', // ตรวจสอบ user id
		};

		// Log values before insert
		// console.log('AddCustomer values:', values);
		try {
			const userId = req.user?.id || '';
			const userTeam = await teamService.getTeamByUserId(userId);
			let teamId = undefined;

			// Add team info only if user is an ACTIVE member of the team
			if (userTeam?.team) {
				const memberRecord = userTeam.members.find(m => m.user_id === userId);
				if (memberRecord && memberRecord.status === 'active') {
					teamId = userTeam.team.team_id;
					values.customer_record_by_team_id = teamId;
				}
			}

			const userContext = { userId, ...(teamId ? { teamId } : {}) };

			// Check if recommender exists, if not create a dummy record
			if (body.referrer_citizen_id) {
				const existingRecommender = await customerService.findByCitizenId(body.referrer_citizen_id, req.user?.access_token, userContext);
				if (!existingRecommender) {
					// console.log(`Recommender ${body.referrer_citizen_id} not found. Creating dummy record.`);

					// Split name
					const nameParts = (body.referrer_name || '').trim().split(/\s+/);
					const fname = nameParts[0] || '';
					const lname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

					const dummyRecommender: CreateCustomerDTO = {
						customer_citizen_id: body.referrer_citizen_id,
						customer_fname_th: fname,
						customer_lname_th: lname,
						customer_recommender_id: '1000000000000', // Root recommender
						customer_position: 'SAG', // Default position
						customer_registerdate: undefined,
						customer_record_by_user_id: req.user?.id || '',
						customer_record_by_team_id: values.customer_record_by_team_id,
						customer_nationality: 'ไทย', // Default
						customer_phone: '-',
						customer_address1: '-',
						customer_address2: '-',
						customer_zipcode: '-',
					};

					try {
						await customerService.createCustomer(dummyRecommender, req.user?.access_token);
						// console.log('Dummy recommender created successfully');
					} catch (dummyErr) {
						console.error('Failed to create dummy recommender:', dummyErr);
						// We proceed even if this fails, as the main insert might still work (unless there's a hard FK constraint I missed)
						// But based on user request "to prevent error", ensuring it exists is the goal. 
						// Failed creation might mean it was created in paralell or some other data issue. 
					}
				}
			}

			// Minimal: ไม่เช็คซ้ำ citizen id, แค่ insert
			const createdCustomer = await customerService.createCustomer(values, req.user?.access_token);

			if (!createdCustomer) {
				throw new Error('ไม่สามารถเพิ่มข้อมูลลูกค้าได้ (ไม่มีข้อมูลตอบกลับ)');
			}

			return res.redirect(`/customer/add/finish/${createdCustomer.customer_id}`);
		} catch (err: any) {
			return res.status(400).render('add-new-customer', {
				error: err.message || 'ไม่สามารถเพิ่มข้อมูลลูกค้าได้',
				values,
				nonce: res.locals.nonce
			});
		}
	}

	async addOldCustomer(req: Request, res: Response) {
		const body = req.body;

		// Map only the fields provided in the old customer form
		// Set sensible defaults/nulls for missing required fields
		const values: CreateCustomerDTO = {
			customer_citizen_id: body.customer_citizen_id,
			customer_fname_th: body.customer_fname_th,
			customer_lname_th: body.customer_lname_th,
			// Defaults for fields not present in old customer form
			customer_fname_en: undefined,
			customer_lname_en: undefined,
			customer_gender: undefined,
			customer_nationality: 'ไทย',
			customer_tax_id: undefined,
			customer_phone: body.customer_phone || undefined,
			customer_birthdate: undefined,
			customer_registerdate: undefined,
			customer_address1: body.customer_address1 || undefined,
			customer_address2: body.customer_address2 || undefined,
			customer_zipcode: body.customer_zipcode || undefined,
			customer_position: body.customer_position,
			customer_consent_status: body.customer_consent === 'on',
			customer_recommender_id: body.referrer_citizen_id || '',
			customer_record_by_user_id: req.user?.id || '',
		};

		// console.log('AddOldCustomer values:', values);

		try {
			const userId = req.user?.id || '';
			const userTeam = await teamService.getTeamByUserId(userId);
			let teamId = undefined;

			// Add team info
			if (userTeam?.team) {
				const memberRecord = userTeam.members.find(m => m.user_id === userId);
				if (memberRecord && memberRecord.status === 'active') {
					teamId = userTeam.team.team_id;
					values.customer_record_by_team_id = teamId;
				}
			}

			const userContext = { userId, ...(teamId ? { teamId } : {}) };

			// Handle Recommender Creation (Similar logic to existing)
			if (body.referrer_citizen_id) {
				const existingRecommender = await customerService.findByCitizenId(body.referrer_citizen_id, req.user?.access_token, userContext);
				if (!existingRecommender) {
					// console.log(`Recommender ${body.referrer_citizen_id} not found. Creating dummy record.`);
					const nameParts = (body.referrer_name || '').trim().split(/\s+/);
					const fname = nameParts[0] || '';
					const lname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

					const dummyRecommender: CreateCustomerDTO = {
						customer_citizen_id: body.referrer_citizen_id,
						customer_fname_th: fname,
						customer_lname_th: lname,
						customer_recommender_id: '1000000000000',
						customer_position: 'SAG',
						customer_registerdate: undefined,
						customer_record_by_user_id: req.user?.id || '',
						customer_record_by_team_id: values.customer_record_by_team_id,
						customer_nationality: 'ไทย',
						customer_phone: '-',
						customer_address1: '-',
						customer_address2: '-',
						customer_zipcode: '-',
					};

					try {
						await customerService.createCustomer(dummyRecommender, req.user?.access_token);
					} catch (dummyErr) {
						console.error('Failed to create dummy recommender:', dummyErr);
					}
				}
			}

			const createdCustomer = await customerService.createCustomer(values, req.user?.access_token);
			if (!createdCustomer) throw new Error('ไม่สามารถเพิ่มข้อมูลลูกค้าได้');

			return res.redirect(`/customer/add/finish/${createdCustomer.customer_id}`);
		} catch (err: any) {
			return res.status(400).render('add-old-customer', {
				error: err.message || 'ไม่สามารถเพิ่มข้อมูลลูกค้าได้',
				values,
				nonce: res.locals.nonce
			});
		}
	}

	async showFinishPage(req: Request, res: Response) {
		try {
			const customerId = req.params.customerId as string;
			const customer = await customerService.findById(customerId, req.user?.access_token);

			if (!customer) {
				return res.redirect('/homepage'); // Or show error
			}

			// Simple sanitization helper
			const escape = (str: any) => {
				if (!str) return '';
				return String(str)
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;")
					.replace(/"/g, "&quot;")
					.replace(/'/g, "&#039;");
			};

			const safeCustomer = {
				...customer,
				customer_fname_th: escape(customer.customer_fname_th),
				customer_lname_th: escape(customer.customer_lname_th),
				customer_citizen_id: escape(customer.customer_citizen_id)
			};

			res.render('finish', {
				user: req.user,
				customer: safeCustomer, // key is still 'customer' for view compatibility
			});
		} catch (err) {
			console.error('Error showing finish page:', err);
			res.redirect('/homepage');
		}
	}

	async search(req: Request, res: Response) {
		try {
			const query = req.query.q as string;
			if (!query) {
				return res.json([]);
			}

			const userId = req.user?.id || '';
			const userTeam = await teamService.getTeamByUserId(userId);
			const userContext: { userId: string, teamId?: string } = {
				userId: userId
			};

			if (userTeam?.team?.team_id) {
				// Only use team context if user is an ACTIVE member
				const memberRecord = userTeam.members.find(m => m.user_id === userId);
				if (memberRecord && memberRecord.status === 'active') {
					userContext.teamId = userTeam.team.team_id;
				}
			}

			// Prioritize Authorization header
			let accessToken = (req.user as any)?.access_token;
			const authHeader = req.headers.authorization;
			if (authHeader && authHeader.startsWith('Bearer ')) {
				accessToken = authHeader.split(' ')[1];
			}

			const results = await customerService.searchCustomers(query, accessToken, userContext);
			res.json(results);
		} catch (err: any) {
			console.error('Search error:', err);
			// Return 401 for valid interceptor handling
			if (err?.message?.includes('JWT expired') || err?.code === 'PGRST303') {
				return res.status(401).json({ error: 'โทเค็นหมดอายุ' });
			}
			res.status(500).json({ error: 'การค้นหาล้มเหลว' });
		}
	}

	async searchAddress(req: Request, res: Response) {
		try {
			const query = req.query.q as string;
			if (!query) {
				return res.json([]);
			}
			const results = await customerService.searchAddress(query, req.user?.access_token);
			res.json(results);
		} catch (err: any) {
			console.error('Address search error:', err);
			// Return 401 for valid interceptor handling
			if (err?.message?.includes('JWT expired') || err?.code === 'PGRST303') {
				return res.status(401).json({ error: 'โทเค็นหมดอายุ' });
			}
			res.status(500).json({ error: 'การค้นหาที่อยู่ล้มเหลว' });
		}
	}

	async showEditForm(req: Request, res: Response) {
		const handleShowEdit = async (token: string, isRetry = false) => {
			try {
				const customerId = req.params.customerId as string;
				const accessToken = token || (req.user as any)?.access_token;
				const customer = await customerService.findById(customerId, accessToken);

				if (!customer) {
					return res.redirect('/homepage');
				}

				let recommender = null;
				if (customer.customer_recommender_id) {
					recommender = await customerService.findByCitizenId(customer.customer_recommender_id, accessToken);
				}

				res.render('edit', { user: req.user, customer, recommender, error: null, nonce: res.locals.nonce });
			} catch (err: any) {
				console.error('Error showing edit form:', err);

				if ((err?.message?.includes('JWT expired') || err?.code === 'PGRST303') && !isRetry) {
					const refreshToken = req.cookies?.refresh_token;
					console.log('[ShowEditForm] JWT Expired. Attempting Refresh.');

					if (refreshToken) {
						try {
							const { refreshSession } = await import('../auth/auth.service.js');
							const { session, error: refreshError } = await refreshSession(refreshToken);

							if (session && !refreshError) {
								console.log('[ShowEditForm] Refresh Successful. Retrying...');
								res.cookie('refresh_token', session.refresh_token, {
									httpOnly: true,
									secure: false, // process.env.NODE_ENV === 'production',
									sameSite: 'lax',
									maxAge: 30 * 24 * 60 * 60 * 1000
								});

								if (req.user) (req.user as any).access_token = session.access_token;
								return handleShowEdit(session.access_token, true);
							} else {
								console.error('[ShowEditForm] Refresh Failed:', refreshError);
							}
						} catch (e) {
							console.error('[ShowEditForm] Seamless Refresh failed:', e);
						}
					}
					return res.redirect('/login?session_expired=true');
				}

				res.redirect('/homepage');
			}
		};
		await handleShowEdit((req.user as any)?.access_token);
	}

	async updateCustomer(req: Request, res: Response) {
		const customerId = req.params.customerId as string;
		const body = req.body;
		const values: Partial<CreateCustomerDTO> = {
			customer_citizen_id: body.customer_citizen_id,
			customer_fname_th: body.customer_fname_th,
			customer_lname_th: body.customer_lname_th,
			customer_fname_en: body.customer_fname_en || undefined,
			customer_lname_en: body.customer_lname_en || undefined,
			customer_gender: body.customer_gender,
			customer_nationality: body.customer_nationality,
			customer_tax_id: body.customer_tax_id || undefined,
			customer_phone: body.customer_phone,
			customer_birthdate: sanitizeDateToCE(body.customer_birthdate),
			customer_registerdate: sanitizeDateToCE(body.customer_reg_date),
			customer_address1: body.customer_address1,
			customer_address2: body.customer_address2,
			customer_zipcode: body.customer_zipcode || undefined,
			customer_position: body.customer_position,
			customer_recommender_id: body.referrer_citizen_id || '',
		};

		try {
			const accessToken = req.user?.access_token;
			const existingCustomer = await customerService.findById(customerId, accessToken);

			// If already consented, don't allow changing it back to false
			if (existingCustomer?.customer_consent_status === true) {
				values.customer_consent_status = true;
			} else {
				values.customer_consent_status = body.customer_consent === 'on';
			}

			const userId = req.user?.id || '';
			const userTeam = await teamService.getTeamByUserId(userId);
			let teamId = undefined;

			// Add team info only if user is an ACTIVE member of the team
			if (userTeam?.team) {
				const memberRecord = userTeam.members.find(m => m.user_id === userId);
				if (memberRecord && memberRecord.status === 'active') {
					teamId = userTeam.team.team_id;
				}
			}

			// Check if recommender exists, if not create a dummy record
			if (body.referrer_citizen_id) {
				const existingRecommender = await customerService.findByCitizenId(body.referrer_citizen_id, req.user?.access_token);
				if (!existingRecommender) {
					// console.log(`Recommender ${body.referrer_citizen_id} not found. Creating dummy record.`);

					// Split name
					const nameParts = (body.referrer_name || '').trim().split(/\s+/);
					const fname = nameParts[0] || '';
					const lname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

					const dummyRecommender: CreateCustomerDTO = {
						customer_citizen_id: body.referrer_citizen_id,
						customer_fname_th: fname,
						customer_lname_th: lname,
						customer_recommender_id: '1000000000000', // Root recommender
						customer_position: 'SAG', // Default position
						customer_registerdate: new Date().toISOString().split('T')[0], // Today
						customer_record_by_user_id: req.user?.id || '',
						customer_record_by_team_id: teamId,
						customer_nationality: 'ไทย', // Default
						customer_phone: '-',
						customer_address1: '-',
						customer_address2: '-',
						customer_zipcode: '-',
					};

					try {
						await customerService.createCustomer(dummyRecommender, req.user?.access_token);
						// console.log('Dummy recommender created successfully');
					} catch (dummyErr) {
						console.error('Failed to create dummy recommender:', dummyErr);
					}
				}
			}

			await customerService.updateCustomer(customerId, values, req.user?.access_token);
			return res.redirect(`/customer/add/finish/${customerId}`);
		} catch (err: any) {
			// Re-render form with error and existing data
			const customer = { ...values, customer_id: customerId }; // Mock object for re-render
			return res.status(400).render('edit', {
				user: req.user,
				customer,
				error: err.message || 'ไม่สามารถแก้ไขข้อมูลลูกค้าได้',
				nonce: res.locals.nonce
			});
		}
	}

	async listCustomers(req: Request, res: Response) {
		const handleListCustomers = async (token: string, isRetry = false) => {
			try {
				const limit = 20;
				const page = parseInt(req.query.page as string) || 1;
				const offset = (page - 1) * limit;
				const search = req.query.search as string;

				const userId = req.user?.id || '';
				const userTeam = await teamService.getTeamByUserId(userId);
				const userContext: { userId: string, teamId?: string } = {
					userId: userId
				};

				let userTeamRole = null;

				if (userTeam?.team?.team_id) {
					const memberRecord = userTeam.members.find(m => m.user_id === userId);
					if (memberRecord && memberRecord.status === 'active') {
						userContext.teamId = userTeam.team.team_id;
						userTeamRole = memberRecord.role;
					}
				}

				const { customers, total } = await customerService.findAll(limit, offset, search, token, userContext);
				const totalPages = Math.ceil(total / limit);

				res.render('list', {
					user: req.user,
					customers,
					currentPage: page,
					totalPages,
					totalItems: total,
					searchQuery: search || '',
					userTeamRole
				});

			} catch (err: any) {
				console.error('Error listing customers:', err);

				// Check for JWT expiry
				if ((err?.message?.includes('JWT expired') || err?.code === 'PGRST303') && !isRetry) {
					// Try to Refresh! (Seamless experience)
					const refreshToken = req.cookies?.refresh_token;
					if (refreshToken) {
						try {
							const { refreshSession } = await import('../auth/auth.service.js');
							const { session, error } = await refreshSession(refreshToken);

							if (session && !error) {
								// Update Cookies
								res.cookie('refresh_token', session.refresh_token, {
									httpOnly: true,
									secure: process.env.NODE_ENV === 'production',
									sameSite: 'lax',
									maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
								});

								// Inject NEW Access Token into req.user for current request context
								if (req.user) {
									(req.user as any).access_token = session.access_token;
								}

								// RETRY with new token
								return handleListCustomers(session.access_token, true);
							}
						} catch (refreshErr) {
							console.error('Seamless Refresh failed:', refreshErr);
						}
					}
					return res.redirect('/login?session_expired=true');
				} else if (err?.message?.includes('JWT expired')) {
					return res.redirect('/login?session_expired=true');
				}

				res.redirect('/homepage');
			}
		};

		// Initial Call
		await handleListCustomers(req.user?.access_token || '');
	}

	async deleteCustomer(req: Request, res: Response) {
		try {
			const customerId = req.params.customerId as string;

			// 1. Verify existence and Fetch details for permission check
			const customer = await customerService.findById(customerId, req.user?.access_token);
			if (!customer) {
				return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });
			}

			// 2. Check Permissions (Backend Guard)
			const userId = req.user?.id || '';

			if (customer.customer_record_by_team_id) {
				// Team Record: Check if user is Leader/Co-leader of THIS team
				const userTeam = await teamService.getTeamByUserId(userId);
				// Ensure user is in the SAME team as the customer record
				if (!userTeam?.team || userTeam.team.team_id !== customer.customer_record_by_team_id) {
					return res.status(403).json({ error: 'ไม่มีสิทธิ์: คุณไม่ได้เป็นสมาชิกของทีมที่เป็นเจ้าของข้อมูลนี้' });
				}

				const memberRecord = userTeam.members.find(m => m.user_id === userId);
				if (!memberRecord || memberRecord.status !== 'active' || !['leader', 'co-leader'].includes(memberRecord.role)) {
					return res.status(403).json({ error: 'ไม่มีสิทธิ์: เฉพาะผู้นำทีมหรือรองผู้นำทีมเท่านั้นที่มีสิทธิ์ลบข้อมูลลูกค้าของทีม' });
				}
			} else {
				// Private Record: Check Ownership
				if (customer.customer_record_by_user_id !== userId) {
					return res.status(403).json({ error: 'ไม่มีสิทธิ์: การดำเนินการนี้ไม่ใช่ข้อมูลของคุณ' });
				}
			}

			await customerService.deleteCustomer(customerId, req.user?.access_token);
			res.json({ success: true });
		} catch (err: any) {
			console.error('Error deleting customer:', err);
			if (err?.message?.includes('JWT expired') || err?.code === 'PGRST303') {
				return res.status(401).json({ error: 'โทเค็นหมดอายุ' });
			}
			res.status(500).json({ error: 'ไม่สามารถลบข้อมูลลูกค้าได้' });
		}
	}
	async getCustomerDetails(req: Request, res: Response) {
		try {
			const customerId = req.params.customerId as string;
			const customer = await customerService.findById(customerId, req.user?.access_token);

			if (!customer) {
				return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });
			}

			let recommender = null;
			if (customer.customer_recommender_id) {
				// Assuming recommender_id is citizen_id based on previous usage
				recommender = await customerService.findByCitizenId(customer.customer_recommender_id, req.user?.access_token);
			}

			res.json({
				customer,
				recommender
			});
		} catch (err: any) {
			console.error('Error fetching customer details:', err);
			if (err?.message?.includes('JWT expired') || err?.code === 'PGRST303') {
				return res.status(401).json({ error: 'โทเค็นหมดอายุ' });
			}
			res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลลูกค้าได้' });
		}
	}

	async ocrIdCard(req: Request, res: Response) {
		try {
			const { image } = req.body;
			if (!image) {
				return res.status(400).json({ error: 'ไม่พบรูปภาพในการทำ OCR' });
			}

			// Clean base64 header if present (e.g. data:image/jpeg;base64,...)
			const base64Image = image.replace(/^data:image\/\w+;base64,/, '');

			let accessToken = '';
			try {
				accessToken = await getGoogleAccessToken();
			} catch (authErr: any) {
				console.error('Google Vision Authentication error:', authErr);
				return res.status(500).json({ error: 'ไม่สามารถเปิดสิทธิ์เข้าใช้ Google Vision OCR ได้' });
			}

			// Make the Google Cloud Vision API request
			const visionUrl = 'https://vision.googleapis.com/v1/images:annotate';
			const response = await fetch(visionUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`
				},
				body: JSON.stringify({
					requests: [
						{
							image: {
								content: base64Image
							},
							features: [
								{
									type: 'TEXT_DETECTION'
								}
							]
						}
					]
				})
			});

			if (!response.ok) {
				const errText = await response.text();
				console.error('Google Vision API error:', errText);
				return res.status(500).json({ error: 'การดึงข้อมูล OCR ล้มเหลวจากการตอบรับของ Google API' });
			}

			const data = await response.json();
			const fullText = data.responses?.[0]?.fullTextAnnotation?.text || '';

			if (!fullText) {
				return res.status(200).json({
					success: false,
					message: 'ไม่พบข้อความในรูปภาพบัตรประชาชน',
					data: null
				});
			}

			// Parsing logic
			// 1. Citizen ID (13 digits)
			const cidRegex = /(\d)\s*[-_]?\s*(\d{4})\s*[-_]?\s*(\d{5})\s*[-_]?\s*(\d{2})\s*[-_]?\s*(\d)/;
			const cidMatch = fullText.match(cidRegex);
			let citizenId = '';
			if (cidMatch) {
				citizenId = cidMatch.slice(1, 6).join('');
			} else {
				const cleaned = fullText.replace(/[^0-9]/g, '');
				const match13 = cleaned.match(/\d{13}/);
				if (match13) {
					citizenId = match13[0];
				}
			}

			// 2. Thai Name
			const thaiNameRegex = /(?:ชื่อตัวและชื่อสกุล|ชื่อตัว|ชื่อสกุล|ชื่อ)\s*(นาย|นางสาว|นาง|น\.ส\.)?\s*([ก-๙]+)\s+([ก-๙]+)/;
			const thNameMatch = fullText.match(thaiNameRegex);
			let fnameTh = '';
			let lnameTh = '';
			let titleTh = '';
			if (thNameMatch) {
				titleTh = thNameMatch[1] || '';
				fnameTh = thNameMatch[2];
				lnameTh = thNameMatch[3];
			} else {
				const fallbackThRegex = /(นาย|นางสาว|นาง|น\.ส\.)\s*([ก-๙]+)\s+([ก-๙]+)/;
				const fallbackMatch = fullText.match(fallbackThRegex);
				if (fallbackMatch) {
					titleTh = fallbackMatch[1];
					fnameTh = fallbackMatch[2];
					lnameTh = fallbackMatch[3];
				}
			}

			// Map gender from title
			let gender = '';
			if (titleTh) {
				if (titleTh === 'นาย') {
					gender = 'ชาย';
				} else if (titleTh === 'นาง' || titleTh === 'นางสาว' || titleTh === 'น.ส.') {
					gender = 'หญิง';
				}
			}

			// 3. English Name
			const enNameRegex = /(?:Name|First\s*name)\s*(?:Mr\.|Mrs\.|Miss|Ms\.)?\s*([A-Za-z]+)/i;
			const enLastNameRegex = /(?:Last\s*name|Surname)\s*([A-Za-z]+)/i;
			const enNameMatch = fullText.match(enNameRegex);
			const enLastNameMatch = fullText.match(enLastNameRegex);
			const fnameEn = enNameMatch ? enNameMatch[1] : '';
			const lnameEn = enLastNameMatch ? enLastNameMatch[1] : '';

			// Helper functions for month parsing
			const parseEnglishMonth = (str: string): string | null => {
				const months: { [key: string]: string } = {
					jan: '01', january: '01',
					feb: '02', february: '02',
					mar: '03', march: '03',
					apr: '04', april: '04',
					may: '05',
					jun: '06', june: '06',
					jul: '07', july: '07',
					aug: '08', august: '08',
					sep: '09', september: '09', sept: '09',
					oct: '10', october: '10',
					nov: '11', november: '11',
					dec: '12', december: '12'
				};
				const prefix = str.substring(0, 3).toLowerCase();
				return months[prefix] || null;
			};

			const parseThaiMonth = (str: string): string | null => {
				const months: { [key: string]: string } = {
					'มค': '01', 'มกราคม': '01',
					'กพ': '02', 'กุมภาพันธ์': '02',
					'มีค': '03', 'มีนาคม': '03',
					'เมย': '04', 'เมษายน': '04',
					'พค': '05', 'พฤษภาคม': '05',
					'มิย': '06', 'มิถุนายน': '06',
					'กค': '07', 'กรกฎาคม': '07',
					'สค': '08', 'สิงหาคม': '08',
					'กย': '09', 'กันยายน': '09',
					'ตค': '10', 'ตุลาคม': '10',
					'พย': '11', 'พฤศจิกายน': '11',
					'ธค': '12', 'ธันวาคม': '12'
				};
				const cleanStr = str.replace(/[^ก-๙]/g, '');
				for (const key of Object.keys(months)) {
					if (cleanStr.includes(key)) {
						return months[key] || null;
					}
				}
				return null;
			};

			// 4. Birthdate
			const enDobRegex = /(?:Date\s*of\s*Birth|DOB)\s*(\d{1,2})\s+([A-Za-z\.]+)\s+(\d{4})/i;
			const enDobMatch = fullText.match(enDobRegex);
			let birthdate = '';

			if (enDobMatch) {
				const day = enDobMatch[1].padStart(2, '0');
				const monthStr = enDobMatch[2].toLowerCase().replace('.', '');
				const year = enDobMatch[3];
				const month = parseEnglishMonth(monthStr);
				if (month) {
					birthdate = `${year}-${month}-${day}`;
				}
			}

			if (!birthdate) {
				const thDobRegex = /(?:เกิดวันที่|วันเกิด)\s*(\d{1,2})\s+([ก-๙\.]+)\s+(\d{4})/;
				const thDobMatch = fullText.match(thDobRegex);
				if (thDobMatch) {
					const day = thDobMatch[1].padStart(2, '0');
					const monthStr = thDobMatch[2].replace('.', '');
					const beYear = parseInt(thDobMatch[3]);
					const year = beYear - 543;
					const month = parseThaiMonth(monthStr);
					if (month) {
						birthdate = `${year}-${month}-${day}`;
					}
				}
			}

			// 5. Address
			let rawAddress = '';
			const addressStartRegex = /ที่อยู่\s+(.+)/;
			const addressMatch = fullText.match(addressStartRegex);
			if (addressMatch) {
				const afterAddressText = fullText.substring(fullText.indexOf(addressMatch[0]));
				const lines = afterAddressText.split('\n');
				const addressLines: string[] = [];
				addressLines.push(lines[0].replace(/^ที่อยู่\s+/, '').trim());
				
				for (let i = 1; i < lines.length; i++) {
					const line = lines[i].trim();
					if (line.includes('ศาสนา') || line.includes('วันออกบัตร') || line.includes('วันหมดอายุ') || line.includes('บัตรประจำตัว') || line.includes('Date of') || line.includes('Name') || line.includes('Last name') || line.length === 0) {
						break;
					}
					addressLines.push(line);
				}
				rawAddress = addressLines.join(' ');
			} else {
				const lines = fullText.split('\n');
				const addressLines: string[] = [];
				for (const line of lines) {
					const cleanLine = line.trim();
					if ((cleanLine.includes('หมู่ที่') || cleanLine.includes('ต.') || cleanLine.includes('อ.') || cleanLine.includes('จ.') || cleanLine.includes('ตำบล') || cleanLine.includes('อำเภอ') || cleanLine.includes('จังหวัด')) && !cleanLine.includes('ที่อยู่')) {
						addressLines.push(cleanLine);
					}
				}
				if (addressLines.length > 0) {
					rawAddress = addressLines.join(' ');
				}
			}

			let address1 = rawAddress;
			let address2 = '';
			
			// Split strictly at ต. / ตำบล / แขวง
			const subdistrictSplitRegex = /(ตำบล|ต\.|แขวง)/;
			const splitMatch = rawAddress.match(subdistrictSplitRegex);
			if (splitMatch && splitMatch.index !== undefined) {
				const index = splitMatch.index;
				address1 = rawAddress.substring(0, index).trim();
				address2 = rawAddress.substring(index).trim();
			}

			// Clean up fields from common OCR noise/labels at the end
			const cleanOcrNoise = (str: string) => {
				return str
					.replace(/ศาสนา\s*[ก-๙]+/g, '')
					.replace(/วันออกบัตร.*/g, '')
					.replace(/วันหมดอายุ.*/g, '')
					.trim();
			};

			const cleanedAddress2 = cleanOcrNoise(address2);
			if (address1) {
				address1 = cleanOcrNoise(address1);
			}

			// Extract components from address2 to match in DB zipcode_th
			let subdistrictName = '';
			let districtName = '';
			let provinceName = '';

			const subMatch = cleanedAddress2.match(/(?:ตำบล|ต\.|แขวง)\s*([ก-๙]+)/);
			if (subMatch && subMatch[1]) {
				subdistrictName = subMatch[1].trim();
			}

			const distMatch = cleanedAddress2.match(/(?:อำเภอ|อ\.|เขต)\s*([ก-๙]+)/);
			if (distMatch && distMatch[1]) {
				districtName = distMatch[1].trim();
			}

			const provMatch = cleanedAddress2.match(/(?:จังหวัด|จ\.)\s*([ก-๙]+)/);
			if (provMatch && provMatch[1]) {
				provinceName = provMatch[1].trim();
			} else if (cleanedAddress2.includes('กรุงเทพมหานคร')) {
				provinceName = 'กรุงเทพมหานคร';
			} else if (cleanedAddress2.includes('กรุงเทพฯ')) {
				provinceName = 'กรุงเทพมหานคร';
			}

			// Handle special capital district (Amphoe Mueang) where DB has "เมือง[Province]"
			if (provinceName && provinceName !== 'กรุงเทพมหานคร' && districtName === 'เมือง') {
				districtName = 'เมือง' + provinceName;
			}

			let zipcode = '';
			if (provinceName && districtName && subdistrictName) {
				try {
					const zipMatch = await customerService.findZipcodeMatch(
						provinceName,
						districtName,
						subdistrictName,
						req.user?.access_token
					);

					if (zipMatch) {
						address2 = zipMatch.full_locate;
						zipcode = String(zipMatch.zipcode);
					} else {
						address2 = cleanedAddress2;
					}
				} catch (dbErr) {
					console.error('Error matching address to zipcode_th:', dbErr);
					address2 = cleanedAddress2;
				}
			} else {
				address2 = cleanedAddress2;
			}

			const parsedData = {
				citizenId,
				fnameTh,
				lnameTh,
				fnameEn,
				lnameEn,
				gender,
				birthdate,
				address1,
				address2,
				zipcode
			};

			return res.status(200).json({
				success: true,
				data: parsedData,
				fullText
			});

		} catch (err: any) {
			console.error('OCR Controller error:', err);
			return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการประมวลผล OCR บัตรประชาชน' });
		}
	}
}

export const customerController = new CustomerController();
