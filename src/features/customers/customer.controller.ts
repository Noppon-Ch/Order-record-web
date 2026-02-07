import type { Request, Response } from 'express';
import { customerService } from './customer.service.js';
import { teamService } from '../teams/services/team.service.js';
import type { CreateCustomerDTO } from './customer.types.js';

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
			customer_birthdate: body.customer_birthdate,
			customer_registerdate: body.customer_reg_date,
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
						customer_registerdate: new Date().toISOString().split('T')[0], // Today
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
				throw new Error('Failed to create customer (no data returned).');
			}

			return res.redirect(`/customer/add/finish/${createdCustomer.customer_id}`);
		} catch (err: any) {
			return res.status(400).render('add-new-customer', {
				error: err.message || 'Failed to add customer.',
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
			customer_phone: undefined,
			customer_birthdate: undefined,
			customer_registerdate: undefined,
			customer_address1: undefined,
			customer_address2: undefined,
			customer_zipcode: undefined,
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
						customer_registerdate: new Date().toISOString().split('T')[0],
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
			if (!createdCustomer) throw new Error('Failed to create customer.');

			return res.redirect(`/customer/add/finish/${createdCustomer.customer_id}`);
		} catch (err: any) {
			return res.status(400).render('add-old-customer', {
				error: err.message || 'Failed to add customer.',
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

			const results = await customerService.searchCustomers(query, req.user?.access_token, userContext);
			res.json(results);
		} catch (err) {
			console.error('Search error:', err);
			res.status(500).json({ error: 'Search failed' });
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
		} catch (err) {
			console.error('Address search error:', err);
			res.status(500).json({ error: 'Address search failed' });
		}
	}

	async showEditForm(req: Request, res: Response) {
		try {
			const customerId = req.params.customerId as string;
			const customer = await customerService.findById(customerId, req.user?.access_token);
			if (!customer) {
				return res.redirect('/homepage');
			}

			let recommender = null;
			if (customer.customer_recommender_id) {
				recommender = await customerService.findByCitizenId(customer.customer_recommender_id, req.user?.access_token);
			}

			res.render('edit', { user: req.user, customer, recommender, error: null, nonce: res.locals.nonce });
		} catch (err) {
			console.error('Error showing edit form:', err);
			res.redirect('/homepage');
		}
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
			customer_birthdate: body.customer_birthdate,
			customer_registerdate: body.customer_reg_date,
			customer_address1: body.customer_address1,
			customer_address2: body.customer_address2,
			customer_zipcode: body.customer_zipcode || undefined,
			customer_position: body.customer_position,
			customer_recommender_id: body.referrer_citizen_id || '',
			// update record_by? maybe track last_modified_by
		};


		try {
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
				error: err.message || 'Failed to update customer.',
				nonce: res.locals.nonce
			});
		}
	}

	async listCustomers(req: Request, res: Response) {
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
				// Only use team context if user is an ACTIVE member
				const memberRecord = userTeam.members.find(m => m.user_id === userId);
				if (memberRecord && memberRecord.status === 'active') {
					userContext.teamId = userTeam.team.team_id;
					userTeamRole = memberRecord.role;
				}
			}

			const customers = await customerService.findAll(limit, offset, search, req.user?.access_token, userContext);

			res.render('list', {
				user: req.user,
				customers,
				currentPage: page,
				searchQuery: search || '',
				userTeamRole
			});
		} catch (err) {
			console.error('Error listing customers:', err);
			res.redirect('/homepage');
		}
	}

	async deleteCustomer(req: Request, res: Response) {
		try {
			const customerId = req.params.customerId as string;

			// 1. Verify existence and Fetch details for permission check
			const customer = await customerService.findById(customerId, req.user?.access_token);
			if (!customer) {
				return res.status(404).json({ error: 'Customer not found' });
			}

			// 2. Check Permissions (Backend Guard)
			const userId = req.user?.id || '';

			if (customer.customer_record_by_team_id) {
				// Team Record: Check if user is Leader/Co-leader of THIS team
				const userTeam = await teamService.getTeamByUserId(userId);
				// Ensure user is in the SAME team as the customer record
				if (!userTeam?.team || userTeam.team.team_id !== customer.customer_record_by_team_id) {
					return res.status(403).json({ error: 'Unauthorized: You are not a member of the team owning this record.' });
				}

				const memberRecord = userTeam.members.find(m => m.user_id === userId);
				if (!memberRecord || memberRecord.status !== 'active' || !['leader', 'co-leader'].includes(memberRecord.role)) {
					return res.status(403).json({ error: 'Unauthorized: Only Leader or Co-leader can delete team customers.' });
				}
			} else {
				// Private Record: Check Ownership
				if (customer.customer_record_by_user_id !== userId) {
					return res.status(403).json({ error: 'Unauthorized: You do not own this customer.' });
				}
			}

			await customerService.deleteCustomer(customerId, req.user?.access_token);
			res.json({ success: true });
		} catch (err) {
			console.error('Error deleting customer:', err);
			res.status(500).json({ error: 'Failed to delete customer' });
		}
	}
	async getCustomerDetails(req: Request, res: Response) {
		try {
			const customerId = req.params.customerId as string;
			const customer = await customerService.findById(customerId, req.user?.access_token);

			if (!customer) {
				return res.status(404).json({ error: 'Customer not found' });
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
		} catch (err) {
			console.error('Error fetching customer details:', err);
			res.status(500).json({ error: 'Failed to fetch customer details' });
		}
	}
}

export const customerController = new CustomerController();
