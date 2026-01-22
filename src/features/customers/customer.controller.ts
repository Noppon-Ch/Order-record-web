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
			await customerService.createCustomer(values, req.user?.access_token);
			return res.redirect('/customers');
		} catch (err: any) {
			return res.status(400).render('add', {
				error: err.message || 'Failed to add customer.',
				values
			});
		}
	}
}

export const customerController = new CustomerController();
