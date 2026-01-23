import type { Request, Response } from 'express';
import { customerService } from './customer.service.js';
import type { CreateCustomerDTO } from './customer.types.js';

export class CustomerController {
	async showAddForm(req: Request, res: Response) {
		const user = req.user;
		res.render('add', { user, error: null, values: {} });
	}

	async addCustomer(req: Request, res: Response) {
		// Log user and accessToken for debugging
		console.log('req.user:', req.user);
		console.log('req.user.access_token:', req.user?.access_token);
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
			customer_consent_status: false, // PDPA ยังไม่บันทึกจริง
			customer_recommender_id: body.referrer_citizen_id || '',
			customer_record_by_user_id: req.user?.id || '', // ตรวจสอบ user id
		};

		// Log values before insert
		console.log('AddCustomer values:', values);
		try {
			// Minimal: ไม่เช็คซ้ำ citizen id, แค่ insert
			const createdCustomer = await customerService.createCustomer(values, req.user?.access_token);

			if (!createdCustomer) {
				throw new Error('Failed to create customer (no data returned).');
			}

			return res.redirect(`/customer/add/finish/${createdCustomer.customer_id}`);
		} catch (err: any) {
			return res.status(400).render('add', {
				error: err.message || 'Failed to add customer.',
				values
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
			const results = await customerService.searchCustomers(query, req.user?.access_token);
			res.json(results);
		} catch (err) {
			console.error('Search error:', err);
			res.status(500).json({ error: 'Search failed' });
		}
	}
}

export const customerController = new CustomerController();
